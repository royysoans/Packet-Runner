/**
 * Synth Sound Engine — generates all game sounds via Web Audio API
 * No external audio files needed.
 */
export default class SoundEngine {
    constructor() {
        this.ctx = null;
        this._initialized = false;
        this._masterGain = null;
    }

    /** Must be called from a user gesture (click) */
    init() {
        if (this._initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this.ctx.createGain();
        this._masterGain.gain.value = 0.35;
        this._masterGain.connect(this.ctx.destination);
        this._initialized = true;
    }

    _osc(type, freq, duration, startTime = 0) {
        if (!this._initialized) return;
        const t = this.ctx.currentTime + startTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + duration);
    }

    _noise(duration, startTime = 0) {
        if (!this._initialized) return;
        const t = this.ctx.currentTime + startTime;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 4000;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._masterGain);
        source.start(t);
    }

    // ── Game Sounds ──

    /** Player moves to a node */
    move() {
        this._osc('sine', 440, 0.08);
        this._osc('sine', 660, 0.06, 0.04);
    }

    /** Packet arrives at a node */
    arrive() {
        this._osc('sine', 880, 0.1);
        this._osc('triangle', 1100, 0.08, 0.05);
    }

    /** Collect a powerup */
    powerup() {
        this._osc('sine', 523, 0.08);
        this._osc('sine', 659, 0.08, 0.08);
        this._osc('sine', 784, 0.08, 0.16);
        this._osc('sine', 1047, 0.15, 0.24);
    }

    /** Take damage */
    damage() {
        this._osc('sawtooth', 200, 0.15);
        this._osc('sawtooth', 120, 0.2, 0.05);
        this._noise(0.1);
    }

    /** Firewall blocks path */
    blocked() {
        this._osc('square', 180, 0.06);
        this._osc('square', 120, 0.1, 0.06);
    }

    /** Combo achieved */
    combo(level) {
        const base = 600 + level * 100;
        this._osc('sine', base, 0.05);
        this._osc('sine', base + 200, 0.05, 0.05);
        this._osc('triangle', base + 400, 0.1, 0.1);
    }

    /** Level complete fanfare */
    victory() {
        const notes = [523, 659, 784, 1047, 1319, 1568];
        notes.forEach((freq, i) => {
            this._osc('sine', freq, 0.2, i * 0.1);
            this._osc('triangle', freq * 0.5, 0.2, i * 0.1);
        });
    }

    /** Game over */
    gameOver() {
        this._osc('sawtooth', 300, 0.3);
        this._osc('sawtooth', 200, 0.4, 0.15);
        this._osc('sawtooth', 100, 0.6, 0.35);
        this._noise(0.3, 0.2);
    }

    /** Random event alert */
    alert() {
        this._osc('square', 800, 0.06);
        this._osc('square', 1000, 0.06, 0.08);
        this._osc('square', 800, 0.06, 0.16);
    }

    /** Timer tick when low */
    tick() {
        this._osc('sine', 1200, 0.03);
    }

    /** UI click */
    click() {
        this._osc('sine', 600, 0.04);
    }

    /** Countdown timer urgent beep */
    urgentTick() {
        this._osc('square', 1000, 0.05);
        this._osc('square', 1200, 0.03, 0.05);
    }
}

// Singleton
export const soundEngine = new SoundEngine();
