import { FSKModulator, FSKDemodulator } from './fsk-modem.js'

let ctx;
let modulator, demodulator;

const $initBtn = $('#init');
const $sendBtn = $('#send');
const $inputField = $('#input');
const $outputField = $('#output');
const $freqGraph = $('svg');
const $debugPane = $('.debug');

let xScale, yScale;

const w = $freqGraph.width();
const h = $freqGraph.height();
const numberOfBars = w;
let updateBuffer;

function aggregate(data) {
    const dLen = data.length;
    const scaleX = numberOfBars / dLen;
    const d = new Float32Array(numberOfBars);

    const c = [];
    for (let x = 0; x < numberOfBars; ++x) {
        d[x] = 0;
        c[x] = 0;
    }

    for (let i = 0; i < dLen; ++i) {
        const xi = (i * scaleX) | 0;
        d[xi] += data[i];
        c[xi]++;
    }

    for (let x = 0; x < numberOfBars; ++x) {
        d[x] = (d[x] / c[x]) | 0;
    }
    return d;
}

async function getInputStream() {
    const constraints = {
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            highpassFilter: false,
            echoCancellation: false,
            sampleRate: 48000,
            channelCount: 1,
        }
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
}

let recvBuffer = [];
let textEncoder = new TextEncoder();
let textDecoder = new TextDecoder();

async function onSendClick() {
    const text = $inputField.val();
    let data = [];
    text.split('').map(c => {
        // data.push(0);
        const encoded = textEncoder.encode(c);
        data.push(0);
        encoded.forEach(v => {
            data.push(2);
            data.push(v);
        });
        data.push(0);
    });

    modulator.sendData(data);
}

let readyToGetAnotherCode = false;

async function onRecv(v) {
    if (v < 0 || v > 255) return; // noise
    // 0 A 0 B 0
    // 0 A 0
    if (v === 2) {
        readyToGetAnotherCode = true;
        return;
    }
    if (v === 0 && recvBuffer.length) {
        console.log('decode', recvBuffer);
        $outputField.val($outputField.val() + textDecoder.decode((new Uint8Array(recvBuffer)).buffer));
        recvBuffer.length = 0;
        return;
    }
    if (readyToGetAnotherCode) {
        recvBuffer.push(v);
        $debugPane.text(recvBuffer.join(', '))
        console.log('push', v);
        readyToGetAnotherCode = false;
    }
}

const freqGraph = d3.select('#freq_graph');
function onFFTUpdate(data) {
    updateBuffer = [...data];
}

function render() {
    requestAnimationFrame(render);
    if (!updateBuffer) return;

    freqGraph.selectAll('rect.bar')
        .data(aggregate(updateBuffer))
        .join("rect")
        .attr("class", "bar")
        .attr("x", (_, i) => xScale(i))
        .attr("width", () => w / numberOfBars)
        .attr("y", (d) => h - yScale(d))
        .attr("height", d => {
            const v = yScale(d);
            return v > 0 ? v : 0;
        });
}

function runFFT() {
    xScale = d3.scaleLinear().range([0, w]).domain([0, numberOfBars]);
    yScale = d3.scaleLinear().range([0, h]).domain([
        demodulator.analyser.minDecibels,
        demodulator.analyser.maxDecibels,
    ]);

    const xScaleHz = d3.scaleLinear()
        .range([0, w])
        .domain([0, ctx.sampleRate / 2]);

    const xAxis = d3
        .axisBottom()
        .scale(xScaleHz)
        .ticks(ctx.sampleRate / 2 / 2000)
        .tickFormat(d => d / 1000);

    freqGraph.append("g")
        .attr('class', 'axis')
        .call(xAxis)

    requestAnimationFrame(render);
}

async function onInitClick() {
    ctx = new AudioContext();
    await ctx.audioWorklet.addModule(window.location.href + '/js/generator.js?_=' + (+new Date()));
    const inputStream = await getInputStream();

    modulator = new FSKModulator(ctx);
    demodulator = new FSKDemodulator(ctx, inputStream, onRecv, onFFTUpdate);
    demodulator.run();

    runFFT();
    $sendBtn.removeAttr('disabled');
    $('fieldset').removeAttr('disabled');
}

$sendBtn.on('click', onSendClick);
$initBtn.on('click', onInitClick);

