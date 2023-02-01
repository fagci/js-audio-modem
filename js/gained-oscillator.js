export default class GainedOscillator {
    constructor(ctx, tone = 440) {
        const g = ctx.createGain();
        const osc = ctx.createOscillator();

        this.gain = g.gain;

        g.gain.value = 0;
        osc.frequency.value = tone;

        g.connect(ctx.destination);
        osc.connect(g);
        osc.start();
    }

    emit(t, dur = 0.2) {
        this.gain.setValueAtTime(0, t);
        this.gain.linearRampToValueAtTime(1, t + 0.001);
        this.gain.setValueAtTime(1, t + dur - 0.001);
        this.gain.linearRampToValueAtTime(0, t + dur);
    }
}

