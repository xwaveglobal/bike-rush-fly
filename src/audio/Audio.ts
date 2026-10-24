// Procedural Web Audio API synthesizer for SFX & synthwave background music

export class SoundEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled = true;
  public musicEnabled = true;
  private musicTimer: number | null = null;
  private musicStep = 0;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startMusic(): void {
    this.unlock();
    if (this.musicTimer !== null) return;
    const bassNotes = [110, 110, 130.81, 146.83, 98, 98, 130.81, 164.81];
    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const freq = bassNotes[this.musicStep % bassNotes.length];
      this.musicStep += 1;
      this.tone(freq, 0.14, 'sawtooth', 0.035, freq * 1.5);
    }, 220);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number,
    endFreq?: number
  ): void {
    if (!this.soundEnabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playClick(): void {
    this.unlock();
    this.tone(620, 0.05, 'triangle', 0.07, 880);
  }

  public playLane(): void {
    this.tone(280, 0.08, 'sine', 0.08, 420);
  }

  public playHop(): void {
    this.tone(240, 0.18, 'triangle', 0.11, 660);
  }

  public playDive(): void {
    this.tone(420, 0.15, 'sine', 0.1, 150);
  }

  public playCoin(): void {
    this.tone(987.77, 0.09, 'sine', 0.08, 1318.5);
  }

  public playRing(): void {
    this.tone(587.33, 0.22, 'triangle', 0.12, 1174.66);
  }

  public playPowerup(): void {
    this.tone(440, 0.26, 'sawtooth', 0.09, 880);
  }

  public playSpecial(): void {
    this.tone(220, 0.45, 'sawtooth', 0.13, 960);
  }

  public playCrash(): void {
    this.tone(140, 0.38, 'sawtooth', 0.16, 38);
  }
}
