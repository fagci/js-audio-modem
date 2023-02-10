import { FSKModulator, FSKDemodulator } from './fsk-modem.js'

const $initBtn = $('#init');
const $sendBtn = $('#send');
const $inputField = $('#input');
const $outputField = $('#output');
const $freqGraph = $('svg');
const $debugPane = $('.debug');

const w = $freqGraph.width();
const h = $freqGraph.height();
const numberOfBars = w;

let ctx;
let modulator, demodulator;

let updateBuffer;
let xScale, yScale;

function aggregate(data) {
    const binSize = data.length / numberOfBars;
    return Array(numberOfBars)
        .fill()
        .map((_, i) => {
            const b = data.slice(i * binSize, (i + 1) * binSize)
            return b.reduce((s, v) => s + v) / b.length
        })
}

async function getInputStream() {
    const constraints = {
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            highpassFilter: false,
            echoCancellation: false,
            sampleRate: 44100,
            channelCount: 1,
        }
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
}

let recvBuffer = [];
const textDecoder = new TextDecoder();

function encode(text) {
    const textEncoder = new TextEncoder();
    let data = [];
    text.split('').forEach(c => {
        data.push(0);
        textEncoder.encode(c).forEach(v => {
            data.push(2);
            data.push(v);
        });
        data.push(0);
    });
    return data;
}

async function onSendClick() {
    const text = $inputField.val();
    modulator.sendData(encode(text));
}

let readyToGetAnotherCode = false;

async function onRecv(v) {
    if (v < 0 || v > 255) return; // noise
    if (v === 2) {
        readyToGetAnotherCode = true;
        return;
    }
    if (v === 0 && recvBuffer.length) {
        $outputField.val($outputField.val() + textDecoder.decode((new Uint8Array(recvBuffer)).buffer));
        recvBuffer.length = 0;
        return;
    }
    if (readyToGetAnotherCode) {
        recvBuffer.push(v);
        $debugPane.text(recvBuffer.join(', '))
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
    ctx = new AudioContext({
        sampleRate: 44100,
    });
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

