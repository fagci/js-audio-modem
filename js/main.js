import { FSKModulator, FSKDemodulator } from './fsk-modem.js'

let ctx;
let modulator, demodulator;

const $initBtn = $('#init');
const $sendBtn = $('#send');
const $inputField = $('#input');
const $outputField = $('#output');
const $freqGraph = $('svg');

let xScale, yScale;

const w = $freqGraph.width();
const h = $freqGraph.height();
const numberOfBars = w;
let updateBuffer;



function aggregate(data) {
    const aggregated = new Float32Array(numberOfBars);
    const bucketSize = Math.floor(data.length / numberOfBars);

    for (let i = 0; i < numberOfBars; i++) {
        const bucket = data.slice(i * bucketSize, (i + 1) * bucketSize);
        aggregated[i] = bucket.reduce((s, d) => s + d, 0) / bucketSize;
    }

    return aggregated;
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

async function onSendClick() {
    modulator.sendText($inputField.val());
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
    yScale = d3.scaleLinear().range([0, h]).domain([0, 255]);

    const xScaleHz = d3.scaleLinear()
        .range([0, w])
        .domain([0, ctx.sampleRate / 2]);

    const xAxis = d3
        .axisBottom()
        .scale(xScaleHz)
        .ticks(5)
        .tickFormat(d => d / 1000 + "K");

    freqGraph.append("g").call(xAxis)

    requestAnimationFrame(render);
}

async function onInitClick() {
    ctx = new AudioContext();
    ctx.audioWorklet.addModule('./js/generator.js?_=' + (+new Date()));
    const inputStream = await getInputStream();

    modulator = new FSKModulator(ctx);
    demodulator = new FSKDemodulator(ctx, inputStream, v => $outputField.val($outputField.val() + v), onFFTUpdate);
    demodulator.run();

    runFFT();
}

$sendBtn.on('click', onSendClick);
$initBtn.on('click', onInitClick);

