import GainedOscillator from './gained-oscillator.js'
import PitchDetector from './pitch-detector.js'

const DUR = 3;

const SYNC_INTERVAL = DUR / 4 * 1000;

const F_MULTIPLIER = 16;
const F_ADD = 10000;

const SYNC_START = 0xff;
const SYNC_END = 0x01;

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

        text = [SYNC_START, SYNC_END].map(v => String.fromCharCode(v)).join('') + text;

        const START_TIME = this.ctx.currentTime;

        this.textToByteArray(text).forEach((byte, i) => {
            this.oscillators[byte].emit(START_TIME + i * DUR, DUR);
        });
    }
}

class FSKDemodulator {
    constructor(ctx, inputStream, onRecv) {
        this.ctx = ctx;
        this.onRecv = onRecv;

        this.recving = false;
        this.syncing = false;
        this.syncStarted = false;

        this.pitchDetector = new PitchDetector();
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        this.buffer = new Float32Array(this.analyser.frequencyBinCount);
        const input = ctx.createMediaStreamSource(inputStream);

        /* const from = F_ADD / 2;
        const to = F_ADD + 256 * F_MULTIPLIER;
        const geometricMean = Math.sqrt(from * to);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = geometricMean;
        filter.Q.value = geometricMean / (to - from);

        input.connect(filter); */
        input.connect(this.analyser);
    }

    run() {
        this.runSync();
    }

    runSync() {
        clearInterval(this.recving);
        this.recving = false;
        this.syncStarted = false;
        this.syncing = setInterval(this.sync, SYNC_INTERVAL);
    }

    runRecv() {
        clearInterval(this.syncing);
        this.syncing = false;
        this.syncStarted = false;
        this.recving = setInterval(this.recv, DUR * 1000);
    }

    syncStart() {
        console.log('syncing...');
        this.syncStarted = true;
    }

    syncEnd() {
        console.log('synced.');
        this.runRecv();
    }

    sync = () => {
        const code = this.getCode();

        if (!this.syncStarted && code == SYNC_START) {
            this.syncStart();
            return;
        }

        if (this.syncStarted) {
            if (code) console.log(code);
        }

        if (this.syncStarted && code == SYNC_END) {
            this.syncEnd();
        }
    }

    recv = () => {
        const code = this.getCode();

        if (code) {
            this.onRecv(String.fromCharCode(code))
            return;
        }

        console.log('out of sync');
        this.runSync();
    }

    getCode() {
        this.analyser.getFloatTimeDomainData(this.buffer);
        const f = this.pitchDetector.autoCorrelate(this.buffer, this.ctx.sampleRate);
        console.log(f);
        if (f >= 0) {
            return Math.round((f - F_ADD) / F_MULTIPLIER);
        }
        return 0;
    }
}

export {
    FSKModulator,
    FSKDemodulator
};