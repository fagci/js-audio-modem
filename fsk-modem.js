import GainedOscillator from './gained-oscillator.js'
import PitchDetector from './pitch-detector.js'

const DUR = 0.2;

const SYNC_INTERVAL = DUR / 4 * 1000;

const F_MULTIPLIER = 8;
const F_ADD = 1024;

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

        text = `\xff\x01${text}`;

        const START_TIME = this.ctx.currentTime;

        this.textToByteArray(text).forEach((byte, i) => {
            this.oscillators[byte].emit(START_TIME + i * DUR, DUR);
        });
    }
}

class FSKDemodulator {
    SYNC_START = 0xff;
    SYNC_END = 0x01;

    constructor(ctx, inputStream, onRecv) {
        this.ctx = ctx;
        this.onRecv = onRecv;

        this.recving = false;
        this.syncing = false;
        this.syncStarted = false;

        this.pitchDetector = new PitchDetector();
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 4096;

        this.buffer = new Float32Array(this.analyser.frequencyBinCount);
        const input = ctx.createMediaStreamSource(inputStream);

        const from = F_ADD / 2;
        const to = F_ADD + 256 * F_MULTIPLIER;
        const geometricMean = Math.sqrt(from * to);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = geometricMean;
        filter.Q.value = geometricMean / (to - from);

        input.connect(filter);
        filter.connect(this.analyser);
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

        if (!this.syncStarted && code == this.SYNC_START) {
            this.syncStart();
            return;
        }

        if (this.syncStarted) {
            if (code) console.log(code);
        }

        if (this.syncStarted && code == this.SYNC_END) {
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
        var f = this.pitchDetector.autoCorrelate(this.buffer, this.ctx.sampleRate);
        if (f >= 0) {
            return +((f - F_ADD) / F_MULTIPLIER).toFixed();
        }
        return 0;
    }
}

export  {
    FSKModulator,
    FSKDemodulator
};
