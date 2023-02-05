const OPTIONS = {
    fBase: 16000,
    fMul: 16,
    rate: 6, // codes per second
    syncPhases: true,
    fftSize: 4096,
};

class FSKModulator {
    constructor(ctx) {
        this.ctx = ctx;
        this.oscillators = [];

        const processorOptions = { ...OPTIONS, sampleRate: this.ctx.sampleRate };

        this.osc = new AudioWorkletNode(this.ctx, "generator", { processorOptions });
        this.osc.connect(this.ctx.destination);
    }

    sendData(data) {
        console.log(`sending: ${data}`);
        this.osc.port.postMessage(data);
    }
}

class FSKDemodulator {
    constructor(ctx, inputStream, onRecv, onFFTUpdate = () => { }) {
        this.ctx = ctx;
        this.onRecv = onRecv;
        this.onFFTUpdate = onFFTUpdate;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = OPTIONS.fftSize;

        this.buffer = new Uint8Array(this.analyser.frequencyBinCount);

        const source = ctx.createMediaStreamSource(inputStream);

        const hpFilter = ctx.createBiquadFilter();

        hpFilter.type = 'highpass';

        hpFilter.frequency.value = OPTIONS.fBase - OPTIONS.fMul;

        source.connect(hpFilter);
        hpFilter.connect(this.analyser);
    }

    run() {
        setInterval(this.clock, 0.01);
    }

    clock = () => {
        this.updateFFT()
        this.onRecv(this.getCode());
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
        return Math.round(codeProposal);
    }
}

export {
    FSKModulator,
    FSKDemodulator
};
