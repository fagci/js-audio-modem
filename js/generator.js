class GeneratorProcessor extends AudioWorkletProcessor {
    #message = '';
    #sample = 0;
    #tick = 0;
    #f = 0;
    #cf = 0;

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
                let t = this.#sample / sampleRate;
                let v = this.#sine(this.#cf, t);
                this.#cf = this.#f;
                // sync phases
                /* if (this.#f != this.#cf) {
                    let vNew = this.#sine(this.#f, t);
                    if (Math.abs(v - vNew) < 0.0001) {
                        console.log(this.#sample, v, vNew);
                        this.#cf = this.#f;
                        v = vNew;
                    }
                } */
                channel[i] = v;

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
