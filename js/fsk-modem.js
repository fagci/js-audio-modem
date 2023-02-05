const OPTIONS = {
    fBase: 15000,
    fMul: 16,
    rate: 8, // codes per second
    syncPhases: true,
    fftSize: 4096,
};

class FSKModulator {
    constructor(ctx) {
        this.ctx = ctx;

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
        this.analyser.smoothingTimeConstant = 0.8;

        this.buffer = new Uint8Array(this.analyser.frequencyBinCount);

        const source = ctx.createMediaStreamSource(inputStream);

        const hpFilter = ctx.createBiquadFilter();

        hpFilter.type = 'highpass';

        hpFilter.frequency.value = OPTIONS.fBase - OPTIONS.fMul;

        source.connect(hpFilter);
        hpFilter.connect(this.analyser);
    }

    run() {
        setInterval(this.clock, 1000.0 / OPTIONS.rate / 8);
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
