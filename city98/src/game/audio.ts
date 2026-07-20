/**
 * Fully synthesized soundscape — no audio files, just WebAudio.
 * Footsteps, a boxy engine, birds by day, crickets by night, UI clicks.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private nextAmbient = 0;
  muted = false;

  /** Call from a user gesture. */
  ensure(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.3;
    if (this.radioGain) this.radioGain.gain.value = this.muted ? 0 : 0.16;
    return this.muted;
  }

  private blip(
    type: OscillatorType,
    freqFrom: number,
    freqTo: number,
    dur: number,
    gain: number,
    when = 0
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  step(sprinting: boolean): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 1200, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sprinting ? 260 : 200;
    const g = this.ctx.createGain();
    g.gain.value = 0.11;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  setEngine(active: boolean, speed: number): void {
    if (!this.ctx || !this.master) return;
    if (active && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineOsc.connect(filter);
      this.engineOsc2.connect(filter);
      filter.connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
    }
    if (this.engineOsc && this.engineOsc2 && this.engineGain) {
      const target = active ? 0.1 : 0;
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
      const rpm = 46 + Math.abs(speed) * 4.6;
      this.engineOsc.frequency.setTargetAtTime(rpm, this.ctx.currentTime, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, this.ctx.currentTime, 0.08);
    }
  }

  /** Sparse ambient events; call every frame with the game minute. */
  ambient(minute: number): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now < this.nextAmbient) return;
    const day = minute > 6.5 * 60 && minute < 19.5 * 60;
    if (day) {
      // a little three-note bird
      const base = 2300 + Math.random() * 900;
      this.blip('sine', base, base * 1.3, 0.09, 0.045);
      this.blip('sine', base * 1.2, base * 0.9, 0.07, 0.035, 0.12);
      if (Math.random() < 0.5) this.blip('sine', base * 1.1, base * 1.4, 0.06, 0.03, 0.22);
      this.nextAmbient = now + 2.5 + Math.random() * 5;
    } else {
      // crickets
      for (let i = 0; i < 3; i++) this.blip('square', 4100, 4100, 0.025, 0.014, i * 0.07);
      this.nextAmbient = now + 1.2 + Math.random() * 2.2;
    }
  }

  click(): void {
    this.blip('square', 900, 700, 0.035, 0.05);
  }

  // ---------- car radio: original algorithmic music ----------

  private radioGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private radioStep = 0;
  private radioStation = -1; // -1 = off

  /** Each station is a mood: scale, tempo, waveform, and a bass/drum feel. */
  private static STATIONS = [
    { name: 'KROK 101.5 — Classic Rock', root: 110, scale: [0, 3, 5, 7, 10], bpm: 112, wave: 'sawtooth' as OscillatorType, drums: true },
    { name: 'Q92 — Synth Pop', root: 130.8, scale: [0, 2, 4, 7, 9], bpm: 124, wave: 'square' as OscillatorType, drums: true },
    { name: 'WJZZ — Late Night Jazz', root: 98, scale: [0, 3, 5, 6, 7, 10], bpm: 84, wave: 'triangle' as OscillatorType, drums: false },
    { name: '88.1 — College Radio', root: 146.8, scale: [0, 2, 3, 5, 7, 10], bpm: 96, wave: 'sawtooth' as OscillatorType, drums: true },
  ];

  radioStationName(): string | null {
    return this.radioStation < 0 ? null : GameAudio.STATIONS[this.radioStation].name;
  }

  /** Advance to the next station; wraps to OFF after the last. Returns the label. */
  cycleRadio(): string {
    this.ensure();
    this.radioStation = this.radioStation + 1 >= GameAudio.STATIONS.length ? -1 : this.radioStation + 1;
    if (this.radioStation < 0) {
      this.stopRadio();
      return 'Radio off';
    }
    this.startRadio();
    return GameAudio.STATIONS[this.radioStation].name;
  }

  /** Play a specific station by index (home stereo uses this). */
  playStationIndex(i: number): void {
    this.ensure();
    this.radioStation = Math.max(0, Math.min(GameAudio.STATIONS.length - 1, i));
    this.startRadio();
  }

  private startRadio(): void {
    if (!this.ctx || !this.master) return;
    this.stopRadio();
    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.value = this.muted ? 0 : 0.16;
    this.radioGain.connect(this.master);
    this.radioStep = 0;
    const st = GameAudio.STATIONS[this.radioStation];
    const beat = (60 / st.bpm) * 1000 * 0.5; // eighth notes
    const tick = (): void => {
      this.radioTick();
      this.radioTimer = window.setTimeout(tick, beat);
    };
    tick();
  }

  stopRadio(): void {
    if (this.radioTimer !== null) {
      clearTimeout(this.radioTimer);
      this.radioTimer = null;
    }
    if (this.radioGain) {
      this.radioGain.disconnect();
      this.radioGain = null;
    }
  }

  /** Deterministic-ish note choice so each station has a recognizable feel. */
  private radioTick(): void {
    if (!this.ctx || !this.radioGain) return;
    const st = GameAudio.STATIONS[this.radioStation];
    const t = this.ctx.currentTime;
    const step = this.radioStep++;

    const semi = (n: number) => Math.pow(2, n / 12);
    const degree = st.scale[(step * 3 + Math.floor(step / 8)) % st.scale.length];
    const octave = step % 4 === 0 ? 2 : step % 2 === 0 ? 1 : 0;
    const freq = st.root * semi(degree) * Math.pow(2, octave);

    // lead voice
    const osc = this.ctx.createOscillator();
    osc.type = st.wave;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    const dur = 0.28;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.radioGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);

    // bass on the downbeat
    if (step % 2 === 0) {
      const bass = this.ctx.createOscillator();
      bass.type = 'triangle';
      bass.frequency.value = (st.root * semi(st.scale[0])) / 2;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.6, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      bass.connect(bg).connect(this.radioGain);
      bass.start(t);
      bass.stop(t + 0.36);
    }

    // drums
    if (st.drums) {
      if (step % 4 === 0) this.radioKick(t);
      if (step % 4 === 2) this.radioSnare(t);
      this.radioHat(t, step % 2 === 1 ? 0.5 : 0.28);
    }
  }

  private radioKick(t: number): void {
    if (!this.ctx || !this.radioGain) return;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g).connect(this.radioGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private radioSnare(t: number): void {
    if (!this.ctx || !this.radioGain) return;
    const buf = this.ctx.createBuffer(1, 2200, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(this.radioGain);
    src.start(t);
  }

  private radioHat(t: number, level: number): void {
    if (!this.ctx || !this.radioGain) return;
    const buf = this.ctx.createBuffer(1, 700, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.value = 0.18 * level;
    src.connect(hp).connect(g).connect(this.radioGain);
    src.start(t);
  }
}
