const OPTIONS = {
    fBase: 17000,
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

        this.recvInterval = false;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 4096;

        this.buffer = new Float32Array(this.analyser.frequencyBinCount);
        this.freqs = Array(256).fill().map((_, i) => i * OPTIONS.fMul + OPTIONS.fBase);

        const input = ctx.createMediaStreamSource(inputStream);

        input.connect(this.analyser);
    }

    run() {
        setInterval(this.clock, 0.25 / OPTIONS.rate);
    }

    runRecv() {
        this.recvInterval = setInterval(this.recv, 1000 / OPTIONS.rate);
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
        const filteredFreqValues = this.freqs.map(f => 20*Math.log10(128+this.freqPower(f)));

        const maxValue = Math.max(...filteredFreqValues);
        if (maxValue <= 10) return 0;
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
        if (f > 0) return Math.round((f - OPTIONS.fBase) / OPTIONS.fMul);
        return 0;
    }
}

export {
    FSKModulator,
    FSKDemodulator
};
