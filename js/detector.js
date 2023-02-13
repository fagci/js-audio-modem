class Detector extends AudioWorkletProcessor {
    samprate = 48000;

    process(inputs) {
        const f = this.autoCorrelate(inputs[0][0], this.samprate);
        if (f > 0) {
            this.port.postMessage(f);
        }
        return true;
    }

    autoCorrelate(buf, sampleRate) {
        const MIN_SAMPLES = 0
        var SIZE = buf.length;
        var MAX_SAMPLES = Math.floor(SIZE / 2);
        var best_offset = -1;
        var best_correlation = 0;
        var rms = 0;
        var foundGoodCorrelation = false;
        var correlations = new Array(MAX_SAMPLES);

        for (var i = 0; i < SIZE; i++) {
            var val = buf[i];
            rms += Math.pow(val, 2);
        }

        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) {
            //Not enough signal
            return -1;
        }

        var lastCorrelation = 1;
        for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
            var correlation = 0;

            for (var i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buf[i]) - (buf[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation; // Store for later

            if ((correlation > 0.9) && (correlation > lastCorrelation)) {
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
