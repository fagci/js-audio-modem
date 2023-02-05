const OPTIONS = {
    fBase: 15000,
    fMul: 16,
    rate: 10
};

class FSKModulator {
    constructor(ctx) {
        this.ctx = ctx;
        this.oscillators = [];

        this.osc = new AudioWorkletNode(this.ctx, "generator", {
            processorOptions: { ...OPTIONS, sampleRate: this.ctx.sampleRate }
        });
        this.osc.connect(this.ctx.destination);
    }

    sendText(text) {
        console.log(`sending: ${text}`);
        this.osc.port.postMessage(text);
    }
}

class FSKDemodulator {
    constructor(ctx, inputStream, onRecv, onFFTUpdate = () => { }) {
        this.ctx = ctx;
        this.onRecv = onRecv;
        this.onFFTUpdate = onFFTUpdate;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.minDecibels = -130;

        this.buffer = new Uint8Array(this.analyser.frequencyBinCount);

        const source = ctx.createMediaStreamSource(inputStream);

        // sharp bandpass filter
        const hpFilter = ctx.createBiquadFilter();
        const lpFilter = ctx.createBiquadFilter();

        hpFilter.type = 'highpass';
        lpFilter.type = 'lowpass';

        hpFilter.frequency.value = OPTIONS.fBase - OPTIONS.fMul;
        lpFilter.frequency.value = OPTIONS.fBase + OPTIONS.fMul * 256;

        hpFilter.gain.value = lpFilter.gain.value = -10;

        source.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(this.analyser);
    }

    run() {
        setInterval(this.clock, 0.25 / OPTIONS.rate);
    }

    clock = () => {
        this.updateFFT()

        const code = this.getCode();

        // TODO: check for needeed sequence
        if (this.lastCode == 0 && code) {
            this.onRecv(String.fromCharCode(code));
        }
        this.lastCode = code;
    }

    updateFFT() {
        this.analyser.getByteFrequencyData(this.buffer);
        this.onFFTUpdate(this.buffer);
    }

    getFrequency() {
        const peakValue = Math.max(...this.buffer);
        const peakIndex = this.buffer.indexOf(peakValue);
        return this.i2f(peakIndex);
    }

    i2f(i) {
        return i * this.ctx.sampleRate / (this.buffer.length * 2);
    }

    f2i(f) {
        return f * this.buffer.length * 2 / this.ctx.sampleRate;
    }

    getCode() {
        const f = this.getFrequency();
        const codeProposal = (f - OPTIONS.fBase) / OPTIONS.fMul;
        const code = Math.round(codeProposal);
        if (f > 0 && Math.abs(codeProposal - code) < 0.35) return code;
        return undefined;
    }
}

export {
    FSKModulator,
    FSKDemodulator
};
