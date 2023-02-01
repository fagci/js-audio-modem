import GainedOscillator from './gained-oscillator.js'

const DUR = 0.1;

const CLOCK_INTERVAL = DUR / 4 * 1000;

const F_MULTIPLIER = 16;
const F_ADD = 16000;

class FSKModulator {
    constructor(ctx) {
        this.ctx = ctx;
        this.oscillators = [];

        for (let i = 0; i < 256; i++) {
            this.oscillators.push(new GainedOscillator(ctx, F_ADD + i * F_MULTIPLIER));
        }
    }

    textToByteArray(text) {
        return text.split('').map(v => v.charCodeAt(0))
    }

    sendText(text) {
        console.log(`sending: ${text}`);

        const START_TIME = this.ctx.currentTime;

        this.textToByteArray(text).forEach((byte, i) => {
            this.oscillators[byte].emit(START_TIME + 2 * i * DUR, DUR);
            this.oscillators[0].emit(START_TIME + (2 * i + 1) * DUR, DUR);
        });
    }
}

class FSKDemodulator {
    constructor(ctx, inputStream, onRecv, onFFTUpdate = () => { }) {
        this.ctx = ctx;
        this.onRecv = onRecv;
        this.onFFTUpdate = onFFTUpdate;

        this.recvInterval = false;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        this.freqs = [];
        for (let i = 0; i < 256; i++) {
            this.freqs.push(i * F_MULTIPLIER + F_ADD);
        }

        this.buffer = new Float32Array(this.analyser.frequencyBinCount);
        const input = ctx.createMediaStreamSource(inputStream);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = F_ADD + 128 * F_MULTIPLIER;
        filter.gain.value = 25;

        input.connect(filter);
        filter.connect(this.analyser);
    }

    run() {
        setInterval(this.clock, CLOCK_INTERVAL);
    }

    runRecv() {
        this.recvInterval = setInterval(this.recv, DUR * 1000);
    }

    clock = () => {
        const code = this.getCode();

        // TODO: check for needeed sequence
        if (this.lastCode == 0) {
            if (code) this.onRecv(String.fromCharCode(code));
        }
        this.lastCode = code;
    }

    getKeyByValue(object, value) {
        return Object.keys(object).find(key => object[key] === value);
    }

    getFrequency() {
        // TODO: refactor
        const buf = this.buffer;
        this.analyser.getFloatFrequencyData(buf);
        this.onFFTUpdate(buf);
        const filteredFreqValues = {};
        this.freqs.forEach(f => {
            const i = Math.round(this.f2i(f));
            filteredFreqValues[f] = this.buffer[i];
        });
        // const len = buf.length;
        const maxValue = Math.max(...Object.values(filteredFreqValues));
        // const midValue = buf.reduce((s, v) => s + v, 0) / len;
        if (maxValue <= -90) return 0;
        console.log(maxValue, this.getKeyByValue(filteredFreqValues, maxValue));
        return this.getKeyByValue(filteredFreqValues, maxValue);
    }

    i2f(i) {
        return i * this.ctx.sampleRate / (this.buffer.length * 2);
    }

    f2i(f) {
        return f * (this.buffer.length * 2) / this.ctx.sampleRate;
    }

    getCode() {
        const f = this.getFrequency();
        const isFrequencyExact = Math.abs((f | 0) - f) < F_MULTIPLIER / 4;
        if (f > 0 && isFrequencyExact) return Math.round((f - F_ADD) / F_MULTIPLIER);
        return 0;
    }
}

export {
    FSKModulator,
    FSKDemodulator
};
