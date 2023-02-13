class Detector extends AudioWorkletProcessor {
    buffer = new Float32Array(2048);
    count = 0;
    samprate = 44100;

    process(inputs) {
        const input = inputs[0][1];

        if (this.count < this.buffer.length) {
            for (let i = 0; i < input.length; i++) {
                this.buffer[this.count++] = input[i];
            }
            return true;
        }

        // we have enough data
        const f = this.autoCorrelate(this.buffer, this.samprate);
        if (f > 0) {
            console.log('f:', f, this.count);
            // this.port.postMessage(f);
        }
        this.count = 0;
        return true;
    }

    // based on https://github.com/cwilso/PitchDetect/blob/main/js/pitchdetect.js
    autoCorrelate(buf, sampleRate) {
        var MIN_SAMPLES = 0;
        var GOOD_ENOUGH_CORRELATION = 0.9;
        var SIZE = buf.length;
        var MAX_SAMPLES = Math.floor(SIZE / 2);
        var best_offset = -1;
        var best_correlation = 0;
        var rms = 0;
        var foundGoodCorrelation = false;
        var correlations = new Array(MAX_SAMPLES);
        for (var i = 0; i < SIZE; i++) {
            var val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) // not enough signal
            return -1;
        var lastCorrelation = 1;
        for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
            var correlation = 0;
            for (var i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buf[i]) - (buf[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation; // store it, for the tweaking we need to do below.
            if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
                foundGoodCorrelation = true;
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            } else if (foundGoodCorrelation) {
                var shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
                return sampleRate / (best_offset + (8 * shift));
            }
            lastCorrelation = correlation;
        }
        if (best_correlation > 0.01) {
            return sampleRate / best_offset;
        }
        return -1;
    }
}

registerProcessor('detector', Detector);
