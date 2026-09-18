import { TourState } from '../state/TourState';

/**
 * Centralized background audio controller.
 * Manages a single persistent HTMLAudioElement for the entire virtual tour lifetime.
 * Guarantees cross-platform compliance (iOS Safari, Android Chrome, Desktop)
 * with direct synchronous audio playback on the user's first legitimate interaction
 * (tapping the intro screen), and direct synchronous audio.muted / play() control.
 */
export class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private tourState: TourState;
  private defaultVolume = 0.25;
  private previousVolume = 0.25;
  private hasStarted = false;
  private wasPlayingBeforeHidden = false;

  private constructor() {
    this.tourState = TourState.get();
    const config = this.tourState.getConfig();

    this.defaultVolume = config.audio.defaultVolume ?? 0.25;
    this.previousVolume = this.defaultVolume;

    // 1. Create a single persistent audio element and attach to DOM
    this.audio = document.createElement('audio');
    this.audio.id = 'tour-background-audio';
    this.audio.src = config.audio.src;
    this.audio.loop = true;
    this.audio.preload = 'auto';

    // Inline playback attributes for iOS Safari WebKit
    try {
      (this.audio as any).playsInline = true;
    } catch (_) {}
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    this.audio.style.display = 'none';

    try {
      this.audio.volume = this.defaultVolume;
    } catch {
      // Some mobile platforms (iOS) treat volume as hardware-controlled
    }
    this.audio.muted = false;

    document.body.appendChild(this.audio);

    // 2. Synchronize reactive state on all native audio element events
    const onStateChange = () => this.syncState();
    this.audio.addEventListener('volumechange', onStateChange);
    this.audio.addEventListener('play', onStateChange);
    this.audio.addEventListener('playing', onStateChange);
    this.audio.addEventListener('pause', onStateChange);
    this.audio.addEventListener('ended', onStateChange);
    this.audio.addEventListener('error', (e) => {
      console.warn('Background audio error:', e);
      this.syncState();
    });

    // 3. Listen to external TourState changes
    this.tourState.on('audioChange', (state) => {
      if (state.isAudioMuted !== this.isMuted()) {
        if (state.isAudioMuted) {
          this.mute();
        } else {
          this.unmute();
        }
      }
    });

    // 4. Fallback touch unlock: in case user interacted outside IntroScreen
    const unlockFallback = () => {
      if (!this.hasStarted) {
        this.startOnUserGesture();
      }
      window.removeEventListener('pointerdown', unlockFallback);
      window.removeEventListener('touchstart', unlockFallback);
      window.removeEventListener('click', unlockFallback);
      window.removeEventListener('keydown', unlockFallback);
    };

    window.addEventListener('pointerdown', unlockFallback, { passive: true });
    window.addEventListener('touchstart', unlockFallback, { passive: true });
    window.addEventListener('click', unlockFallback, { passive: true });
    window.addEventListener('keydown', unlockFallback, { passive: true });

    // 5. Handle tab visibility / app backgrounding
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!this.audio.paused) {
          this.wasPlayingBeforeHidden = true;
          this.audio.pause();
        }
      } else {
        if (this.wasPlayingBeforeHidden && !this.audio.muted) {
          this.audio.play().catch(() => {});
        }
        this.wasPlayingBeforeHidden = false;
      }
    });

    window.addEventListener('pagehide', () => {
      this.audio.pause();
    });

    window.addEventListener('beforeunload', () => {
      this.audio.pause();
    });

    // Initial state sync (reflects actual audio state before user gesture)
    this.syncState();
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

  /**
   * Starts background audio directly inside the user's first legitimate gesture
   * (e.g. clicking/tapping the intro screen to enter the experience).
   *
   * Executes synchronously inside the event callstack to satisfy strict mobile
   * autoplay policies on iOS Safari and Android Chrome.
   */
  public startOnUserGesture(): void {
    if (this.hasStarted) return;
    this.hasStarted = true;

    try {
      this.audio.volume = this.defaultVolume;
    } catch (_) {}
    this.audio.muted = false;

    // Call play() directly inside the user gesture
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.syncState();
        })
        .catch((err) => {
          console.warn('Playback request blocked or deferred:', err);
          this.syncState();
        });
    } else {
      this.syncState();
    }
  }

  public isMuted(): boolean {
    return this.audio.muted || this.audio.paused || this.audio.volume === 0;
  }

  public isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  /**
   * Synchronously toggles the mute state directly in the user gesture event stack.
   * Returns true if newly muted, false if newly unmuted.
   */
  public toggleMute(): boolean {
    if (this.isMuted()) {
      this.unmute();
      return false;
    } else {
      this.mute();
      return true;
    }
  }

  /**
   * Immediately mutes audio playback.
   */
  public mute(): void {
    if (this.audio.volume > 0) {
      this.previousVolume = this.audio.volume;
    }
    this.audio.muted = true;
    this.audio.pause();
    this.syncState();
  }

  /**
   * Restores volume, unmutes, and resumes playback directly in user gesture stack.
   */
  public unmute(): void {
    this.hasStarted = true;
    this.audio.muted = false;
    if (this.audio.volume === 0) {
      try {
        this.audio.volume = this.previousVolume || this.defaultVolume;
      } catch (_) {}
    }

    if (this.audio.paused) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => this.syncState())
          .catch((err) => {
            console.warn('Audio play request blocked or failed:', err);
            this.syncState();
          });
      }
    }

    this.syncState();
  }

  private syncState(): void {
    const muted = this.isMuted();
    if (this.tourState.getState().isAudioMuted !== muted) {
      this.tourState.setAudioMuted(muted);
    }
  }
}
