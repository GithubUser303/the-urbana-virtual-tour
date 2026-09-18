import { TourState } from '../state/TourState';

/**
 * Centralized background audio controller.
 * Manages a single persistent HTMLAudioElement for the entire virtual tour lifetime.
 * Guarantees cross-platform compliance (iOS Safari, Android Chrome, Desktop)
 * with direct synchronous audio.muted = true / false control and user-gesture playback.
 */
export class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private tourState: TourState;
  private defaultVolume = 0.25;
  private previousVolume = 0.25;
  private hasUnlocked = false;
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
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    this.audio.style.display = 'none';

    try {
      this.audio.volume = this.defaultVolume;
    } catch {
      // Some mobile platforms (iOS) treat volume as read-only
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

    // 3. Listen to external TourState changes (if called from outside)
    this.tourState.on('audioChange', (state) => {
      if (state.isAudioMuted !== this.isMuted()) {
        if (state.isAudioMuted) {
          this.mute();
        } else {
          this.unmute();
        }
      }
    });

    // 4. Initial attempt to play (desktop autoplay permitted)
    this.audio.play().then(() => {
      this.hasUnlocked = true;
      this.syncState();
    }).catch(() => {
      // Autoplay blocked on mobile without user gesture; wait for first interaction
      this.hasUnlocked = false;
    });

    // 5. Unlock / start on first legitimate user interaction
    const unlockOnFirstTouch = () => {
      if (!this.hasUnlocked) {
        this.hasUnlocked = true;
        if (!this.audio.muted) {
          this.audio.play().catch((err) => {
            console.log('Audio playback waiting for explicit tap:', err);
          });
        }
      }
      window.removeEventListener('pointerdown', unlockOnFirstTouch);
      window.removeEventListener('touchstart', unlockOnFirstTouch);
      window.removeEventListener('click', unlockOnFirstTouch);
      window.removeEventListener('keydown', unlockOnFirstTouch);
    };

    window.addEventListener('pointerdown', unlockOnFirstTouch, { passive: true });
    window.addEventListener('touchstart', unlockOnFirstTouch, { passive: true });
    window.addEventListener('click', unlockOnFirstTouch, { passive: true });
    window.addEventListener('keydown', unlockOnFirstTouch, { passive: true });

    // 6. Handle tab visibility / app backgrounding
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

    // Initial state sync
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

  public isMuted(): boolean {
    return this.audio.muted || this.audio.volume === 0;
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
    this.syncState();
  }

  /**
   * Restores volume, unmutes, and resumes playback if paused.
   */
  public unmute(): void {
    this.hasUnlocked = true;
    this.audio.muted = false;
    if (this.audio.volume === 0) {
      this.audio.volume = this.previousVolume || this.defaultVolume;
    }

    // Call play directly inside user gesture stack
    if (this.audio.paused) {
      this.audio.play().catch((err) => {
        console.warn('Audio play request blocked or failed:', err);
        this.syncState();
      });
    }

    this.syncState();
  }

  private syncState(): void {
    const muted = this.isMuted();
    this.tourState.setAudioMuted(muted);
  }
}
