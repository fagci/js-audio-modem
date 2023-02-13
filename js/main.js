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
            sampleRate: 48000,
            channelCount: 1,
        }
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
}

let recvBuffer = [];

function char2bits(s) {
    return s.charCodeAt(0).toString(2).padStart(16, '0').split('').map(v => +v)
}

function bits2char(bits) {
    return String.fromCharCode(parseInt(bits.join(''), 2))
}

const SEND_LEN = 64;

var ldpc = new LDPC({ n: SEND_LEN, k: 16, modulo: 2 });

console.log(bits2char(ldpc.decode(ldpc.encode(char2bits('F')))))

function encode(text) {
    let data = [];
    text.split('').forEach(c => {
        const tosend = ldpc.encode(char2bits(c));
        console.log('send', tosend);
        tosend.forEach(v => {
            data.push(v);
        });
    });
    return data;
}

async function onSendClick() {
    const text = $inputField.val();
    modulator.sendData(encode(text));
}

async function onRecv(v) {
    if (v < 0 || v > 1) return; // noise
    recvBuffer.push(v);
    if (recvBuffer.length >= SEND_LEN) {
        const recv = ldpc.decode(recvBuffer);
        console.log('recv', recvBuffer);
        $outputField.val($outputField.val() + bits2char(recv));
        recvBuffer.length = 0;
        return;
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
    await ctx.audioWorklet.addModule(window.location.href + '/js/detector.js?_=' + (+new Date()));
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

