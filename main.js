import PitchDetector from './pitch-detector.js'

const DUR = 0.1;
const d = window.document;

let ctx;
let analyser;
let oscillators = [];

let buffer;

const pitchDetector = new PitchDetector();

const initBtn = d.getElementById('init');
const sendBtn = d.getElementById('send');
const inputField = d.getElementById('input');
const outputField = d.getElementById('output');

class GainedOscillator {
    constructor(ctx, tone = 440) {
        const g = ctx.createGain();
        const osc = ctx.createOscillator();

        this.gain = g.gain;

        g.gain.value = 0;
        osc.frequency.value = tone;

        g.connect(ctx.destination);
        osc.connect(g);
        osc.start();
    }

    emit(t, dur = 0.2) {
        this.gain.setValueAtTime(0, t);
        this.gain.linearRampToValueAtTime(1, t + 0.001);
        this.gain.setValueAtTime(1, t + dur - 0.001);
        this.gain.linearRampToValueAtTime(0, t + dur);
    }
}

function textToByteArray(text) {
    return text.split('').map(v => v.charCodeAt(0))
}

function sendText(text) {
    console.log(`sending: ${text}`);

    const START_TIME = ctx.currentTime;

    textToByteArray(text).forEach((byte, i) => {
        oscillators[byte].emit(START_TIME + i * DUR, DUR);
    });
}

async function getInputStream() {
    const constraints = {
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 48000,
            channelCount: 1,
        }
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
}

async function onSendClick() {
    sendText(inputField.value);
}

async function onInitClick() {
    ctx = new window.AudioContext();
    analyser = ctx.createAnalyser();

    analyser.fftSize = 2048;
    buffer = new Float32Array(analyser.frequencyBinCount);
    const inputStream = await getInputStream();
    const input = ctx.createMediaStreamSource(inputStream);
    input.connect(analyser);

    setInterval(update, DUR * 1000);

    for (let i = 0; i < 256; i++) {
        oscillators.push(new GainedOscillator(ctx, i * 20));
    }
}

function update() {
    analyser.getFloatTimeDomainData(buffer);
    var ac = pitchDetector.autoCorrelate(buffer, ctx.sampleRate);
    if (ac > 0) {
        const char = String.fromCharCode((ac / 20).toFixed());
        outputField.value += char;
    }
}

sendBtn.addEventListener('click', onSendClick);
initBtn.addEventListener('click', onInitClick);

