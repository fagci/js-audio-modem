import PitchDetector from './pitch-detector.js'

const DUR = 0.1;
const SYNC_INTERVAL = DUR / 4 * 1000;
const SYNC_START = 0xff;
const SYNC_END = 0x01;
const F_MULTIPLIER = 8;
const F_ADD = 1024;
const d = window.document;

let ctx;
let analyser;
let oscillators = [];

let buffer;

let T = 0;
let syncStart = 0;
let recving = false;
let syncing = false;
var syncStarted = false;

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

    text = `\xff\x00\xff\x00\xff\x00\xff\x01${text}`;

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
            highpassFilter: false,
            echoCancellation: false,
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

    analyser.fftSize = 4096;
    buffer = new Float32Array(analyser.frequencyBinCount);
    const inputStream = await getInputStream();
    const input = ctx.createMediaStreamSource(inputStream);

    const from = F_ADD / 2;
    const to = F_ADD + 256 * F_MULTIPLIER;
    const geometricMean = Math.sqrt(from * to);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = geometricMean;
    filter.Q.value = geometricMean / (to - from);

    input.connect(filter);
    filter.connect(analyser);

    syncing = setInterval(sync, SYNC_INTERVAL);

    for (let i = 0; i < 256; i++) {
        oscillators.push(new GainedOscillator(ctx, F_ADD + i * F_MULTIPLIER));
    }
}

function getCode() {
    analyser.getFloatTimeDomainData(buffer);
    var f = pitchDetector.autoCorrelate(buffer, ctx.sampleRate);
    if (f >= 0) {
        return +((f - F_ADD) / F_MULTIPLIER).toFixed();
    }
    return 0;
}


function sync() {
    if (recving) return;

    const code = getCode();
    code && console.log(code);
    if (!syncStarted && syncing && code == SYNC_START) {
        console.log('start sync');
        syncStart = ctx.currentTime;
        syncStarted = true;
        return;
    }

    if (syncStarted) {
        if (code) console.log(code);
    }

    if (syncStarted && syncing && code == SYNC_END) {
        clearInterval(syncing);
        syncing = false;
        T = ctx.currentTime - syncStart;
        console.log('interval:', T);
        syncStarted = false;
        recving = setInterval(recv, DUR * 1000);
    }
}

function recv() {
    const code = getCode();
    if (!code) {
        clearInterval(recving);
        recving = false;
        syncing = setInterval(sync, SYNC_INTERVAL);
        console.log('out of sync');
        return;
    }
    const char = String.fromCharCode(code);
    outputField.value += char;
}

sendBtn.addEventListener('click', onSendClick);
initBtn.addEventListener('click', onInitClick);

