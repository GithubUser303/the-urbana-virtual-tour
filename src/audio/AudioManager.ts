import { TourState } from '../state/TourState';

export class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private tourState: TourState;
  private isInitialized = false;
  private isFading = false;
  private targetVolume = 0.4;
  private fadeInterval: number | null = null;

  public getIsFading(): boolean {
    return this.isFading;
  }

  private constructor() {
    this.tourState = TourState.get();
    const config = this.tourState.getConfig();

    this.audio = new Audio(config.audio.src);
    this.audio.loop = true;
    this.targetVolume = config.audio.defaultVolume ?? 0.4;
    this.audio.volume = this.targetVolume;

    // Listen to state changes
    this.tourState.on('audioChange', (state) => {
      if (state.isAudioMuted) {
        this.fadeOutAndPause();
      } else {
        this.playWithFadeIn();
      }
    });

    // Auto-unlock on first user interaction
    const unlock = () => {
      if (!this.isInitialized) {
        this.isInitialized = true;
        if (!this.tourState.getState().isAudioMuted) {
          this.playWithFadeIn();
        }
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public static init(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public async playWithFadeIn(): Promise<void> {
    try {
      this.clearFade();
      this.audio.volume = 0;
      await this.audio.play();

      this.isFading = true;
      const step = 0.04;
      this.fadeInterval = window.setInterval(() => {
        if (this.audio.volume < this.targetVolume - step) {
          this.audio.volume += step;
        } else {
          this.audio.volume = this.targetVolume;
          this.clearFade();
        }
      }, 50);
    } catch (err) {
      console.log('Background music playback blocked or failed:', err);
    }
  }

  public fadeOutAndPause(): void {
    this.clearFade();
    this.isFading = true;
    const step = 0.05;

    this.fadeInterval = window.setInterval(() => {
      if (this.audio.volume > step) {
        this.audio.volume -= step;
      } else {
        this.audio.volume = 0;
        this.audio.pause();
        this.clearFade();
      }
    }, 50);
  }

  private clearFade(): void {
    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.isFading = false;
  }
}
