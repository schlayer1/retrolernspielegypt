/**
 * Schlanker 16-Bit Web-Audio-Synthesizer (Zero-Asset) für Soundeffekte.
 */
class SoundFX {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  pickup(): void {
    this.tone(523.25, 0.07, 'square', 0.07, 0);
    this.tone(659.25, 0.1, 'square', 0.07, 0.06);
  }

  craft(): void {
    this.tone(392, 0.08, 'triangle', 0.09, 0);
    this.tone(523.25, 0.08, 'triangle', 0.09, 0.08);
    this.tone(783.99, 0.16, 'triangle', 0.09, 0.16);
  }

  quest(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.12, 'square', 0.08, i * 0.09));
  }

  eat(): void {
    this.tone(330, 0.07, 'sine', 0.09, 0);
    this.tone(440, 0.09, 'sine', 0.09, 0.08);
  }

  click(): void {
    this.tone(600, 0.03, 'square', 0.05, 0);
  }

  fanfare(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => this.tone(f, 0.16, 'square', 0.1, i * 0.1));
  }

  step(): void {
    this.tone(180, 0.04, 'sine', 0.04, 0);
  }

  cave(): void {
    this.tone(130, 0.3, 'triangle', 0.08, 0);
  }

  door(): void {
    this.tone(220, 0.08, 'triangle', 0.08, 0);
    this.tone(160, 0.14, 'triangle', 0.07, 0.06);
  }
}

export const sfx = new SoundFX();

/**
 * Hintergrundmusik-Player (BGM) mit nahtlosem HTML5-Audio-Loop und Stummschalt-Gedächtnis.
 */
class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private currentTrack = '';
  private _muted = false;
  private _volume = 0.35;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('kemet_bgm_muted');
      if (savedMute !== null) this._muted = savedMute === 'true';
    }
  }

  get isMuted(): boolean {
    return this._muted;
  }

  play(trackPath: string, vol = 0.35): void {
    if (typeof window === 'undefined') return;
    this._volume = vol;
    if (this.currentTrack === trackPath && this.audio) {
      if (!this._muted && this.audio.paused) {
        this.audio.play().catch(() => {});
      }
      return;
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    this.currentTrack = trackPath;
    const a = new Audio(trackPath);
    a.loop = true;
    a.volume = this._muted ? 0 : this._volume;
    this.audio = a;

    const tryPlay = () => {
      a.play().catch(() => {
        const onFirstInteract = () => {
          if (!this._muted) a.play().catch(() => {});
          window.removeEventListener('click', onFirstInteract);
          window.removeEventListener('keydown', onFirstInteract);
        };
        window.addEventListener('click', onFirstInteract, { once: true });
        window.addEventListener('keydown', onFirstInteract, { once: true });
      });
    };
    tryPlay();
  }

  playChapter(ch: number): void {
    const tracks: Record<number, string> = {
      1: 'assets/audio/bgm/ch1_dunes.ogg',
      2: 'assets/audio/bgm/ch2_scorchlight.ogg',
      3: 'assets/audio/bgm/ch3_whispers.ogg',
      4: 'assets/audio/bgm/ch4_canyon.ogg',
      5: 'assets/audio/bgm/ch5_sunblade.ogg',
      6: 'assets/audio/bgm/ch6_oasis.ogg',
    };
    const track = tracks[ch] || 'assets/audio/bgm/ch1_dunes.ogg';
    this.play(track, 0.32);
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kemet_bgm_muted', String(this._muted));
    }
    if (this.audio) {
      this.audio.volume = this._muted ? 0 : this._volume;
      if (this._muted) {
        this.audio.pause();
      } else {
        this.audio.play().catch(() => {});
      }
    }
    return this._muted;
  }
}

export const bgm = new BackgroundMusic();

