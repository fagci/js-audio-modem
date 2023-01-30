import PitchDetector from './pitch-detector.js'

const DUR = 0.2;
const SYNC_START = 0x01;
const SYNC_END = 0xff;
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

    text = `\x01\xff${text}`;

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
    input.connect(analyser);

    syncing = setInterval(sync);

    for (let i = 0; i < 256; i++) {
        oscillators.push(new GainedOscillator(ctx, 880 + i * 10));
    }
}

function getCode() {
    analyser.getFloatTimeDomainData(buffer);
    var f = pitchDetector.autoCorrelate(buffer, ctx.sampleRate);
    if (f >= 0) {
        return +((f-880) / 10).toFixed();
    }
    return 0;
}


function sync() {
    if (recving) return;

    const code = getCode();
    if(code)console.log(code);
    if (!syncStarted && syncing && code == SYNC_START) {
        console.log('start sync');
        syncStart = ctx.currentTime;
        syncStarted = true;
        return;
    }

    if (syncStarted && syncing && code == SYNC_END) {
        clearInterval(syncing);
        syncing = false;
        T = ctx.currentTime - syncStart;
        console.log('interval:', T);
        syncStarted = false;
        recving = setInterval(recv, T*1000);
    }
}

function recv() {
    const code = getCode();
    if(!code) {
        clearInterval(recving);
        recving = false;
        syncing = setInterval(sync);
        console.log('out oof sync');
        return;
    }
    const char = String.fromCharCode(code);
    outputField.value += char;
}

sendBtn.addEventListener('click', onSendClick);
initBtn.addEventListener('click', onInitClick);

