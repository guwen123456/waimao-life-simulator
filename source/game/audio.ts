import type { SfxName } from "./types";

const BPM = 112;

const MELODY: (number | null)[] = [
  64, 67, 69, 67, 72, 71, 67, 64,
  69, 72, 76, 72, 69, 67, 64, 72,
  65, 69, 72, 69, 67, 65, 64, 62,
  62, 65, 67, 71, 72, null, null, null,
  67, 72, 74, 76, 74, 72, 69, 67,
  64, 69, 72, 76, 74, 72, 69, 67,
  69, 72, 77, 76, 74, 72, 69, 67,
  71, 74, 79, 77, 76, 72, null, null,
];

const BASS: number[] = [
  36, 40, 43, 40, 36, 40, 45, 43,
  33, 36, 40, 36, 33, 36, 43, 40,
  29, 33, 36, 33, 29, 33, 36, 40,
  31, 35, 38, 35, 31, 35, 38, 41,
  36, 48, 43, 40, 36, 40, 43, 48,
  33, 45, 40, 36, 33, 36, 40, 45,
  29, 41, 36, 33, 29, 33, 41, 36,
  31, 43, 38, 35, 31, 35, 43, 31,
];

const CHORDS: number[][] = [
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 53],
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 53],
];

const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0];
const OHAT = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0];

class HarborAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  musicOn = true;
  sfxOn = true;
  private started = false;

  unlock() {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.master.gain.value = 0.9;
      this.music.gain.value = 0.42;
      this.sfx.gain.value = 0.85;
      this.music.connect(this.analyser);
      this.analyser.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.musicOn) this.startLoop();
    this.started = true;
  }

  meter(): number {
    if (!this.analyser || !this.musicOn) return 0;
    const bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(bins);
    let s = 0;
    for (const b of bins) s += b;
    return s / bins.length / 255;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.music || !this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.42 : 0.0001, this.ctx.currentTime, 0.05);
    if (on) this.startLoop();
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(name?: SfxName) {
    if (!name || !this.sfxOn || !this.ctx || !this.sfx || !this.started) return;
    const t = this.ctx.currentTime + 0.01;
    const wobble = 0.96 + Math.random() * 0.08;
    this.sfxHot = true;
    if (name === "click") this.noiseHit(t, 0.03, 0.08, 4000);
    else if (name === "coin") {
      this.tone(t, 880 * wobble, 0.09, "sine", 0.16);
      this.tone(t + 0.09, 1320 * wobble, 0.14, "triangle", 0.14);
    } else if (name === "win") {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.07, f, 0.18, "triangle", 0.12));
    } else if (name === "stamp") {
      this.noiseHit(t, 0.05, 0.12, 900);
      this.tone(t, 196, 0.2, "triangle", 0.16);
    } else if (name === "lose") {
      this.slide(t, 320, 90, 0.28);
    } else if (name === "tension") {
      this.tone(t, 98, 0.22, "sine", 0.18);
    } else if (name === "notify") {
      this.tone(t, 660, 0.08, "sine", 0.1);
      this.tone(t + 0.09, 880, 0.12, "sine", 0.1);
    } else if (name === "fanfare") {
      [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.09, f, 0.22, "triangle", 0.11));
    }
    this.sfxHot = false;
  }

  private startLoop() {
    if (!this.ctx || this.timer) return;
    this.next = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  private pump() {
    if (!this.ctx || !this.musicOn) return;
    const sp = 60 / BPM / 4;
    while (this.next < this.ctx.currentTime + 0.16) {
      this.voice(this.step % (16 * 8), this.next);
      this.next += sp;
      this.step = (this.step + 1) % (16 * 8);
    }
  }

  private voice(step: number, time: number) {
    const bar = Math.floor(step / 16);
    const local = step % 16;
    if (KICK[local]) this.kick(time);
    if (SNARE[local]) this.snare(time);
    if (HAT[local]) this.noiseHit(time, 0.03, 0.045, 7000);
    if (OHAT[local]) this.noiseHit(time, 0.1, 0.04, 5000);
    if (local === 0) this.chord(time, CHORDS[bar] ?? CHORDS[0]);
    if (step % 2 === 0) {
      const i = step / 2;
      const m = MELODY[i];
      const b = BASS[i];
      if (m) this.tone(time, midi(m), 0.22, "triangle", 0.075, 1600);
      if (b) this.tone(time, midi(b), 0.16, "sine", 0.16, 280);
    }
  }

  private tone(time: number, freq: number, dur: number, type: OscillatorType, peak: number, cutoff?: number) {
    if (!this.ctx || !this.music && !this.sfx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    let node: AudioNode = osc;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(cutoff, time);
      osc.connect(f);
      node = f;
    }
    const dest = this.sfxHot && this.sfx ? this.sfx : this.music;
    if (!dest) return;
    node.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private sfxHot = false;

  private kick(time: number) {
    if (!this.ctx || !this.music) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.55, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(g);
    g.connect(this.music);
    osc.start(time);
    osc.stop(time + 0.16);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private snare(time: number) {
    this.noiseHit(time, 0.12, 0.12, 1800);
    if (!this.ctx || !this.music) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(190, time);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    osc.connect(g);
    g.connect(this.music);
    osc.start(time);
    osc.stop(time + 0.11);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noiseHit(time: number, dur: number, peak: number, hp: number) {
    if (!this.ctx || !this.noise || !this.music) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxHot ? this.sfx! : this.music);
    src.start(time);
    src.stop(time + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  private chord(time: number, notes: number[]) {
    for (const n of notes) this.tone(time, midi(n), 0.9, "sine", 0.03, 900);
  }

  private slide(time: number, from: number, to: number, dur: number) {
    if (!this.ctx || !this.sfx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.08, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
}

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export const audio = new HarborAudio();

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") audio.resume();
  });
}
