// A small Web Audio band: drums, shekere, talking drum, bass, highlife guitar, bells, amapiano log drum, keys,
// horns and pads, playing the grooves in game/music.ts, plus the game's sound effects. Everything is synthesized,
// so there are no audio files to license or download. Optional licensed tracks can replace a mood's groove
// (see public/music/README.md).
import { GROOVES, PENTATONIC, hz, type Groove, type Mood, type Sfx } from "@/game/music";

const LOOKAHEAD = 0.14;
const TICK_MS = 30;

export interface AudioStats { notes: number; sfx: number; mood: Mood | null; running: boolean }

export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private musicBus: GainNode;
  private sfxBus: GainNode;
  private noise: AudioBuffer;
  private timer: number | null = null;
  private groove: Groove | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private files: Partial<Record<Mood, string>> = {};
  private track: HTMLAudioElement | null = null;
  readonly stats: AudioStats = { notes: 0, sfx: 0, mood: null, running: false };

  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // Optional licensed tracks, listed in public/music/manifest.json. Not available when opened from a file.
    if (location.protocol.startsWith("http")) {
      fetch("music/manifest.json").then((r) => (r.ok ? r.json() : {})).then((m) => { this.files = m ?? {}; }).catch(() => {});
    }
  }

  resume() {
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  private musicOn = true;
  private sfxOn = true;
  private musicVol = 1;
  private sfxVol = 1;
  private musicLevel() { return this.musicOn ? 0.32 * this.musicVol : 0; }

  setMusicOn(on: boolean) { this.musicOn = on; this.applyMusic(); }
  setSfxOn(on: boolean) { this.sfxOn = on; this.applySfx(); }
  /** Volume sliders, 0–1. */
  setVolumes(music: number, sfx: number) {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.applyMusic();
    this.applySfx();
  }

  private applyMusic() {
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), now, 0.25);
    if (this.track) this.track.volume = this.musicOn ? 0.5 * this.musicVol : 0;
  }

  private applySfx() {
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.6 * this.sfxVol : 0, this.ctx.currentTime, 0.05);
  }

  /** Switches the groove with a short fade, keeping time. */
  setMood(mood: Mood) {
    if (this.stats.mood === mood) return;
    this.stats.mood = mood;
    const file = this.files[mood];
    if (this.track) { this.track.pause(); this.track = null; }
    if (file) {
      this.groove = null;
      const a = new Audio(`music/${file}`);
      a.loop = true;
      a.volume = this.musicOn ? 0.5 * this.musicVol : 0;
      void a.play().catch(() => {});
      this.track = a;
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.musicBus.gain;
    const level = this.musicLevel();
    g.cancelScheduledValues(now);
    g.setValueAtTime(level, now);
    g.linearRampToValueAtTime(level * 0.2, now + 0.35);
    g.linearRampToValueAtTime(level, now + 1.2);
    this.groove = GROOVES[mood];
    this.step = 0;
    this.bar = 0;
    this.nextTime = Math.max(this.nextTime, now + 0.38);
    if (this.timer === null) {
      this.nextTime = now + 0.1;
      this.timer = window.setInterval(() => this.schedule(), TICK_MS);
      this.stats.running = true;
    }
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stats.running = false;
    this.track?.pause();
    void this.ctx.close();
  }

  // --- the sequencer ---------------------------------------------------------------

  private schedule() {
    const g = this.groove;
    if (!g) return;
    const sixteenth = 60 / g.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const swing = this.step % 2 === 1 ? g.swing * sixteenth : 0;
      this.playStep(g, this.step, this.bar, this.nextTime + swing, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % 64;
    }
  }

  private playStep(g: Groove, i: number, bar: number, t: number, sixteenth: number) {
    const chord = g.chords[bar % g.chords.length];
    const root = chord[0];
    const out = this.musicBus;
    if (g.kick[i]) this.kick(t, g.kick[i], out);
    if (g.clap[i]) this.clap(t, g.clap[i], out);
    if (g.shaker[i]) this.shaker(t, g.shaker[i], out);
    const tk = g.talk[i];
    if (tk !== null) this.talkingDrum(t, hz(PENTATONIC[tk % PENTATONIC.length] - 12), out);
    const b = g.bass[i];
    if (b !== null) this.bass(t, hz(root + b - 24), sixteenth * 2.5, out);
    const a = g.arp[i];
    if (a !== null) {
      const note = hz(chord[a % chord.length] + 12);
      if (g.arpVoice === "guitar") this.pluck(t, note, out); else this.bell(t, note, out);
    }
    const lg = g.log?.[i];
    if (lg !== null && lg !== undefined) this.logDrum(t, hz(root + lg - 24), out);
    if (g.keys?.[i]) this.keys(t, chord.map((n) => hz(n)), sixteenth * 1.6, out);
    if (g.horns?.[i] && g.hornBars?.includes(bar % g.chords.length)) this.horns(t, chord.map((n) => hz(n)), 0.22, out);
    if (g.pad && i === 0) this.pad(t, chord.map((n) => hz(n - 12)), sixteenth * 16, out);
    this.stats.notes++;
  }

  // --- instruments ---------------------------------------------------------------

  private env(t: number, peak: number, attack: number, decay: number, out: AudioNode) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseBurst(t: number, dur: number, filter: BiquadFilterType, freq: number, peak: number, out: AudioNode, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(t, peak, 0.002, dur, out));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private kick(t: number, v: number, out: AudioNode) {
    const g = this.env(t, 0.9 * v, 0.003, 0.28, out);
    const o = this.osc("sine", 150, t, 0.32, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }

  private clap(t: number, v: number, out: AudioNode) {
    for (const d of [0, 0.012, 0.024]) this.noiseBurst(t + d, 0.09, "bandpass", 1500, 0.35 * v, out, 0.8);
  }

  private shaker(t: number, v: number, out: AudioNode) {
    this.noiseBurst(t, 0.045, "highpass", 6500, 0.12 * v, out);
  }

  /** The talking drum: a tuned hit whose pitch bends down, like the drummer squeezing the strings. */
  private talkingDrum(t: number, freq: number, out: AudioNode) {
    const g = this.env(t, 0.45, 0.004, 0.26, out);
    const o = this.osc("triangle", freq * 1.55, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    this.noiseBurst(t, 0.03, "bandpass", 900, 0.12, out, 2);
  }

  private bass(t: number, freq: number, dur: number, out: AudioNode) {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    f.connect(this.env(t, 0.42, 0.01, dur, out));
    this.osc("sawtooth", freq, t, dur, f);
  }

  /** Highlife guitar: a bright, quick pluck. */
  private pluck(t: number, freq: number, out: AudioNode) {
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.7;
    f.connect(this.env(t, 0.22, 0.003, 0.22, out));
    this.osc("triangle", freq, t, 0.25, f);
    this.osc("square", freq * 2, t, 0.08, this.env(t, 0.03, 0.002, 0.06, out));
  }

  private bell(t: number, freq: number, out: AudioNode) {
    this.osc("sine", freq, t, 1.1, this.env(t, 0.16, 0.004, 1.0, out));
    this.osc("sine", freq * 2.76, t, 0.5, this.env(t, 0.05, 0.002, 0.45, out));
  }

  /** Amapiano log drum: a deep, saturated, pitch-dropping bass hit. */
  private logDrum(t: number, freq: number, out: AudioNode) {
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.6 * x); }
    shaper.curve = curve;
    shaper.connect(this.env(t, 0.5, 0.004, 0.42, out));
    const o = this.osc("sine", freq * 2, t, 0.45, shaper);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  }

  private keys(t: number, freqs: number[], dur: number, out: AudioNode) {
    for (const f of freqs) {
      this.osc("sine", f, t, dur, this.env(t, 0.07, 0.006, dur, out));
      this.osc("triangle", f * 2, t, dur * 0.6, this.env(t, 0.025, 0.004, dur * 0.6, out));
    }
  }

  private horns(t: number, freqs: number[], dur: number, out: AudioNode) {
    for (const f of freqs) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05);
      lp.frequency.exponentialRampToValueAtTime(900, t + dur);
      lp.connect(this.env(t, 0.09, 0.02, dur, out));
      this.osc("sawtooth", f, t, dur, lp);
      this.osc("sawtooth", f * 1.006, t, dur, lp);
    }
  }

  private pad(t: number, freqs: number[], dur: number, out: AudioNode) {
    for (const f of freqs) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(out);
      lp.connect(g);
      this.osc("sawtooth", f, t, dur, lp);
      this.osc("sawtooth", f * 1.008, t, dur, lp);
    }
  }

  // --- sound effects ---------------------------------------------------------------

  play(sfx: Sfx) {
    const t = this.ctx.currentTime + 0.01;
    const out = this.sfxBus;
    this.stats.sfx++;
    switch (sfx) {
      case "click":
        this.osc("square", 1250, t, 0.03, this.env(t, 0.06, 0.001, 0.03, out));
        break;
      case "coin":
        this.osc("sine", 988, t, 0.08, this.env(t, 0.3, 0.002, 0.08, out));
        this.osc("sine", 1319, t + 0.08, 0.25, this.env(t + 0.08, 0.3, 0.002, 0.25, out));
        break;
      case "cashOut": {
        const o = this.osc("triangle", 660, t, 0.3, this.env(t, 0.3, 0.004, 0.3, out));
        o.frequency.exponentialRampToValueAtTime(260, t + 0.3);
        break;
      }
      case "good":
        [0, 4, 7, 12].forEach((n, k) => this.pluck(t + k * 0.07, hz(n + 3 + 12), out));
        break;
      case "bad":
        this.horns(t, [hz(-12), hz(-11)], 0.45, out);
        this.kick(t, 0.8, out);
        break;
      case "danger": {
        const g = this.env(t, 0.18, 0.01, 0.9, out);
        const o = this.osc("square", 640, t, 0.9, g);
        for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(k % 2 ? 900 : 640, t + k * 0.15);
        break;
      }
      case "stamp":
        this.kick(t, 1, out);
        this.noiseBurst(t, 0.12, "lowpass", 1200, 0.4, out);
        break;
      case "levelUp":
        [0, 3, 7, 12, 15, 19].forEach((n, k) => this.pluck(t + k * 0.06, hz(n + 12), out));
        for (let k = 0; k < 6; k++) this.clap(t + 0.36 + k * 0.05, 0.6, out);
        this.horns(t + 0.66, [hz(3), hz(7), hz(10)], 0.5, out);
        this.talkingDrum(t + 0.66, hz(-5), out);
        break;
      case "win":
        this.horns(t, [hz(3), hz(7), hz(10)], 0.25, out);
        this.horns(t + 0.28, [hz(5), hz(8), hz(12)], 0.25, out);
        this.horns(t + 0.56, [hz(7), hz(10), hz(15)], 0.8, out);
        [0, 0.1, 0.2, 0.3].forEach((d, k) => this.talkingDrum(t + 0.56 + d, hz(PENTATONIC[4 - k] - 12), out));
        this.kick(t + 0.56, 1, out);
        break;
      case "fail":
        // "Dun, dun, DUN."
        this.horns(t, [hz(-12), hz(-9), hz(-5)], 0.35, out);
        this.kick(t, 1, out);
        this.horns(t + 0.42, [hz(-13), hz(-10), hz(-6)], 0.35, out);
        this.kick(t + 0.42, 1, out);
        this.horns(t + 0.9, [hz(-17), hz(-14), hz(-10)], 1.1, out);
        this.kick(t + 0.9, 1, out);
        break;
      case "trap": {
        // The talking drum asks "wahala?", then a low hit.
        const g = this.env(t, 0.5, 0.004, 0.5, out);
        const o = this.osc("triangle", hz(0), t, 0.5, g);
        o.frequency.exponentialRampToValueAtTime(hz(-14), t + 0.45);
        this.horns(t + 0.3, [hz(-12), hz(-11)], 0.6, out);
        this.kick(t + 0.3, 1, out);
        break;
      }
      case "phone":
        for (const d of [0, 0.5]) {
          this.osc("sine", 440, t + d, 0.35, this.env(t + d, 0.12, 0.01, 0.35, out));
          this.osc("sine", 480, t + d, 0.35, this.env(t + d, 0.12, 0.01, 0.35, out));
        }
        break;
      case "horn":
        for (const d of [0, 0.22]) {
          this.osc("square", 349, t + d, 0.16, this.env(t + d, 0.09, 0.005, 0.16, out));
          this.osc("square", 440, t + d, 0.16, this.env(t + d, 0.09, 0.005, 0.16, out));
        }
        break;
      case "okada": {
        const lfo = this.ctx.createOscillator();
        const depth = this.ctx.createGain();
        lfo.frequency.value = 28;
        depth.gain.value = 18;
        const o = this.osc("sawtooth", 88, t, 0.9, this.env(t, 0.08, 0.05, 0.85, out));
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 1);
        o.frequency.linearRampToValueAtTime(130, t + 0.8);
        break;
      }
      case "plane":
        this.noiseBurst(t, 1.3, "lowpass", 400, 0.25, out);
        this.noiseBurst(t + 0.3, 1.0, "bandpass", 1800, 0.08, out);
        break;
      case "wind":
        this.noiseBurst(t, 1.2, "bandpass", 700, 0.14, out, 3);
        break;
    }
  }
}
