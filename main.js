import { FSKModulator, FSKDemodulator } from './fsk-modem.js'

const d = window.document;

let ctx;
let modulator, demodulator;

const initBtn = d.getElementById('init');
const sendBtn = d.getElementById('send');
const inputField = d.getElementById('input');
const outputField = d.getElementById('output');

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
    modulator.sendText(inputField.value);
}

async function onInitClick() {
    ctx = new window.AudioContext();
    const inputStream = await getInputStream();

    modulator = new FSKModulator(ctx);
    demodulator = new FSKDemodulator(ctx, inputStream, v => outputField.value += v);

    demodulator.run();
}

sendBtn.addEventListener('click', onSendClick);
initBtn.addEventListener('click', onInitClick);

