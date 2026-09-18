import { TourState } from '../state/TourState';

/**
 * Centralized background audio controller.
 * Handles mobile WebKit / Android touch autoplay policies,
 * playsinline compliance, volume support detection, and synchronized state tracking.
 */
export class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private tourState: TourState;
  private isInitialized = false;
  private isFading = false;
  private targetVolume = 0.4;
  private fadeInterval: number | null = null;
  private supportsVolumeControl = true;
  private userExplicitlyMuted = false;

  private constructor() {
    this.tourState = TourState.get();
    const config = this.tourState.getConfig();

    // 1. Create and configure HTMLAudioElement
    this.audio = new Audio();
    this.audio.id = 'tour-background-audio';
    this.audio.src = config.audio.src;
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    this.targetVolume = config.audio.defaultVolume ?? 0.4;

    // Detect if browser allows programmatic volume changes (iOS Safari volume is read-only)
    try {
      this.audio.volume = this.targetVolume;
      this.supportsVolumeControl = Math.abs(this.audio.volume - this.targetVolume) < 0.05;
    } catch {
      this.supportsVolumeControl = false;
    }

    // 2. Track native audio events to guarantee UI matches real playback state
    this.audio.addEventListener('playing', () => {
      this.userExplicitlyMuted = false;
      this.tourState.setAudioMuted(false);
    });

    this.audio.addEventListener('pause', () => {
      if (this.userExplicitlyMuted) {
        this.tourState.setAudioMuted(true);
      }
    });

    this.audio.addEventListener('ended', () => {
      this.tourState.setAudioMuted(true);
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback encountered an error:', e);
      this.clearFade();
      this.tourState.setAudioMuted(true);
    });

    // 3. Listen to TourState audioChange
    this.tourState.on('audioChange', (state) => {
      if (state.isAudioMuted) {
        this.userExplicitlyMuted = true;
        this.fadeOutAndPause();
      } else {
        this.userExplicitlyMuted = false;
        if (!this.isPlaying()) {
          this.playWithFadeIn();
        }
      }
    });

    // 4. Auto-unlock on first legitimate user interaction
    const unlock = async () => {
      if (!this.isInitialized) {
        this.isInitialized = true;
        if (!this.userExplicitlyMuted && !this.tourState.getState().isAudioMuted) {
          await this.playWithFadeIn();
        }
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    // 5. Visibility / tab switch management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!this.audio.paused) {
          this.audio.pause();
        }
      } else {
        // Resume when tab returns, if unmuted by user
        if (this.isInitialized && !this.userExplicitlyMuted && !this.tourState.getState().isAudioMuted) {
          this.playWithFadeIn();
        }
      }
    });

    window.addEventListener('pagehide', () => {
      this.audio.pause();
    });

    window.addEventListener('beforeunload', () => {
      this.audio.pause();
    });
  }

  public static init(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public static getInstance(): AudioManager {
    return AudioManager.init();
  }

  public isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended && this.audio.readyState > 2;
  }

  public getIsFading(): boolean {
    return this.isFading;
  }

  /**
   * Directly toggle audio within a user gesture event stack.
   * Guarantees iOS Safari / Android user-gesture approval.
   */
  public async toggle(): Promise<boolean> {
    this.isInitialized = true;
    if (this.isPlaying()) {
      this.userExplicitlyMuted = true;
      this.fadeOutAndPause();
      this.tourState.setAudioMuted(true);
      return false;
    } else {
      this.userExplicitlyMuted = false;
      const success = await this.playWithFadeIn();
      this.tourState.setAudioMuted(!success);
      return success;
    }
  }

  public async playWithFadeIn(): Promise<boolean> {
    try {
      this.clearFade();
      
      // On platforms supporting programmatic volume (Desktop / Chrome), fade in
      if (this.supportsVolumeControl) {
        this.audio.volume = 0;
      } else {
        this.audio.volume = 1;
      }

      await this.audio.play();

      if (this.supportsVolumeControl) {
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
      }

      this.tourState.setAudioMuted(false);
      return true;
    } catch (err) {
      console.log('Background music playback blocked or failed:', err);
      this.clearFade();
      this.tourState.setAudioMuted(true);
      return false;
    }
  }

  public fadeOutAndPause(): void {
    this.clearFade();

    if (!this.supportsVolumeControl || this.audio.paused) {
      this.audio.pause();
      this.tourState.setAudioMuted(true);
      return;
    }

    this.isFading = true;
    const step = 0.05;
    this.fadeInterval = window.setInterval(() => {
      if (this.audio.volume > step) {
        this.audio.volume -= step;
      } else {
        this.audio.volume = 0;
        this.audio.pause();
        this.clearFade();
        this.tourState.setAudioMuted(true);
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
