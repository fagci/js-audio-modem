class GeneratorProcessor extends AudioWorkletProcessor {
    #message = '';
    #sample = 0;
    #tick = 0;
    #f = 0;

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
        let code = 0;
        if (this.#tick % 2 !== 0) {
            code = message.charCodeAt(0);
            this.#message = message.slice(1);
        }

        this.#f = this.fBase + code * this.fMul;
    }

    process(_, outputs) {
        const samplesPerTick = this.sampleRate / this.rate;

        outputs[0].forEach(channel => {
            for (let i = 0; i < channel.length; i++) {
                if (this.#sample % samplesPerTick === 0) {
                    this.onNextTick();
                    this.#sample = 0;
                    this.#tick++;
                }
                channel[i] = this.#sine(this.#f, this.#sample / sampleRate);
                this.#sample++;
            }
        })

        return true;
    }

    #sine(frequency, time) {
        return Math.sin(frequency * Math.PI * 2 * time)
    }

    #messageProcessor(e) {
        this.#message = e.data;
    }
}

registerProcessor("generator", GeneratorProcessor);
