class GeneratorProcessor extends AudioWorkletProcessor {
    #message = [];
    #sample = 0;
    #f = 0;
    #cf = 0;

    #phi = 0;
    #dPhi = 0;

    constructor(nodeOptions) {
        super();
        Object.assign(this, nodeOptions.processorOptions);
        this.port.onmessage = this.#messageProcessor.bind(this);
    }

    onNextTick() {
        const message = this.#message;
        if (!message.length) {
            this.#f = 0;
            return;
        }
        const code = this.#message.shift();

        this.#f = this.fBase + code * this.fMul;
    }

    process(_, outputs) {
        const samplesPerTick = this.sampleRate / this.rate;
        const sampleRate = this.sampleRate;

        outputs[0].forEach(channel => {
            for (let i = 0; i < channel.length; i++) {
                if (this.#sample % samplesPerTick === 0) {
                    this.onNextTick();
                    this.#sample = 0;
                }
                let t = this.#sample / sampleRate;

                if (this.syncPhases && this.#f !== this.#cf) {
                    this.#dPhi = this.#phi % (2.0 * Math.PI);
                }

                this.#cf = this.#f;
                channel[i] = this.#f === 0 ? 0 : this.#sine(this.#cf, t);

                this.#sample++;
            }
        })

        return true;
    }

    #sine(frequency, time) {
        this.#phi = frequency * Math.PI * 2 * time + this.#dPhi;
        return Math.sin(this.#phi);
    }

    #messageProcessor(e) {
        this.#message = e.data;
    }
}

registerProcessor("generator", GeneratorProcessor);
