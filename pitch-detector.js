export default class PitchDetector {
    constructor() { }

    // Modified version of
    // https://github.com/cwilso/PitchDetect/blob/main/js/pitchdetect.js
    autoCorrelate(buf, sampleRate) {
        // Implements the ACF2+ algorithm
        let sizeVar = buf.length;
        let rms = 0;

        for (let i = 0; i < sizeVar; i++) {
            let val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / sizeVar);
        if (rms < 0.01) return -1; // not enough signal

        let r1 = 0, r2 = sizeVar - 1, thres = 0.2;
        for (let i = 0; i < sizeVar / 2; i++)
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < sizeVar / 2; i++)
            if (Math.abs(buf[sizeVar - i]) < thres) { r2 = sizeVar - i; break; }

        buf = buf.slice(r1, r2);
        sizeVar = buf.length;

        let c = new Array(sizeVar).fill(0);
        for (let i = 0; i < sizeVar; i++)
            for (let j = 0; j < sizeVar - i; j++)
                c[i] = c[i] + buf[j] * buf[j + i];

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < sizeVar; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2;
        let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    }
}
