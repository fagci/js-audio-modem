class GeneratorProcessor extends AudioWorkletProcessor {
    #message = [];

    constructor(nodeOptions) {
        super();
        Object.assign(this, nodeOptions.processorOptions);
        this.port.onmessage = this.#messageProcessor.bind(this);
        this.oscillators = [
            this.osc(3000),
            this.osc(4500),
        ];
    }

    osc(f) {
        const a = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
            a[i] = this.#sine(f, i / sampleRate);
        }
        return a;
    }

    onNextTick() {
        const message = this.#message;
        if (!message.length) {
            this.oscillator = null;
            return;
        }
        const code = this.#message.shift();
        this.oscillator = this.oscillators[code];
    }

    process(_, outputs) {
        const out = outputs[0][0];

        for (let i = 0; i < 128; i++) {
            out[i] = this.oscillator ? this.oscillator[i] : 0;
        }
        this.onNextTick();

        return true;
    }

    #sine(frequency, t) {
        return Math.sin(frequency * Math.PI * 2 * t);
    }

    #messageProcessor(e) {
        this.#message = e.data;
    }
}

registerProcessor("generator", GeneratorProcessor);
