import GainedOscillator from './gained-oscillator.js'

const DUR = 0.1;

const CLOCK_INTERVAL = DUR / 8 * 1000;

const F_MULTIPLIER = 16;
const F_ADD = 17000;

class FSKModulator {
    constructor(ctx) {
        this.ctx = ctx;
        this.oscillators = [];

        for (let i = 0; i < 256; i++) {
            this.oscillators.push(new GainedOscillator(ctx, F_ADD + i * F_MULTIPLIER));
        }
    }

    sendText(text) {
        console.log(`sending: ${text}`);

        const START_TIME = this.ctx.currentTime;

        (new TextEncoder()).encode(text).forEach((byte, i) => {
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
        this.analyser.fftSize = 4096;

        this.buffer = new Float32Array(this.analyser.frequencyBinCount);
        this.freqs = Array(256).fill().map((_, i) => i * F_MULTIPLIER + F_ADD);

        const input = ctx.createMediaStreamSource(inputStream);

        input.connect(this.analyser);
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

    getFrequency() {
        // TODO: refactor
        this.analyser.getFloatFrequencyData(this.buffer);
        this.onFFTUpdate(this.buffer);
        const filteredFreqValues = this.freqs.map(f => this.freqPower(f));
        const maxValue = Math.max(...filteredFreqValues);
        if (maxValue <= -90) return 0;
        const freqIndex = filteredFreqValues.indexOf(maxValue);
        console.log(freqIndex);
        return this.freqs[freqIndex];
    }

    freqPower(f) {
        const i = Math.round(this.f2i(f));
        return this.buffer[i];
    }

    i2f(i) {
        return i * this.ctx.sampleRate / (this.buffer.length * 2);
    }

    f2i(f) {
        return f * this.buffer.length * 2 / this.ctx.sampleRate;
    }

    getCode() {
        const f = this.getFrequency();
        if (f > 0) return Math.round((f - F_ADD) / F_MULTIPLIER);
        return 0;
    }
}

export {
    FSKModulator,
    FSKDemodulator
};
