import './styles/main.css';
import './styles/glass.css';
import './styles/animations.css';
import './styles/ui.css';

import { propertyConfig } from './config/property';
import { TourState } from './state/TourState';
import { GlassLight } from './effects/GlassLight';
import { Parallax } from './effects/Parallax';
import { AudioManager } from './audio/AudioManager';
import { Viewer360 } from './viewer/Viewer360';
import { IntroScreen } from './ui/IntroScreen';
import { AuthGate } from './ui/AuthGate';
import { LoadingIndicator } from './ui/LoadingIndicator';
import { TopBar } from './ui/TopBar';
import { iPhoneSliderNav } from './ui/iPhoneSliderNav';
import { FloorPlan } from './ui/FloorPlan';
import { ScatteredGallery } from './ui/ScatteredGallery';
import { Lightbox } from './ui/Lightbox';
import { ContactModal } from './ui/ContactModal';
import { LocationModal } from './ui/LocationModal';
import { ControlMenu } from './ui/ControlMenu';
import { OrientationPrompt } from './ui/OrientationPrompt';
import { AdminLoginModal } from './ui/AdminLoginModal';

/**
 * The Urbana 360 Virtual Tour Application Bootstrapper
 */
export class TourApp {
  private static instance: TourApp;
  public tourState: TourState;
  public viewer!: Viewer360;
  public sliderNav!: iPhoneSliderNav;
  public introScreen!: IntroScreen;
  private isMounted = false;

  constructor() {
    // 1. Initialize central reactive state
    this.tourState = TourState.init(propertyConfig);

    // 2. Initialize lighting & physics effects
    GlassLight.init();
    Parallax.init();

    // 3. Initialize audio manager (persistent DOM element)
    AudioManager.init();

    // 4. Authenticate before mounting protected tour & loading assets
    this.initAuthAndMount();
  }

  private isCheckingSession = false;
  private currentAuthGate: AuthGate | null = null;
  private currentAdminModal: AdminLoginModal | null = null;

  private isTabAuthenticated(): boolean {
    try {
      return sessionStorage.getItem('tourTabAuthenticated') === 'true';
    } catch {
      return false;
    }
  }

  private getTabRole(): 'user' | 'admin' | null {
    try {
      return (sessionStorage.getItem('tourRole') as 'user' | 'admin') || null;
    } catch {
      return null;
    }
  }

  private setTabAuthenticated(role: 'user' | 'admin' = 'user'): void {
    try {
      sessionStorage.setItem('tourTabAuthenticated', 'true');
      sessionStorage.setItem('tourRole', role);
      this.tourState.setRole(role);
    } catch {}
  }

  private clearTabAuthenticated(): void {
    try {
      sessionStorage.removeItem('tourTabAuthenticated');
      sessionStorage.removeItem('tourRole');
      this.tourState.setRole(null);
    } catch {}
  }

  private setupSessionLifecycle(): void {
    // 1. Re-verify session when tab becomes visible (user returns to browser or device wakes)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.verifyActiveSession();
      }
    });

    // 2. Periodic background verification check (every 2 minutes)
    setInterval(() => {
      this.verifyActiveSession();
    }, 2 * 60 * 1000);
  }

  private async verifyActiveSession(): Promise<void> {
    if (this.isCheckingSession) return;
    this.isCheckingSession = true;

    try {
      // If this tab's sessionStorage marker is missing, trigger re-authentication
      if (!this.isTabAuthenticated()) {
        const lastRole = this.getTabRole() || 'user';
        this.handleSessionExpired(false, lastRole);
        return;
      }

      const res = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache', 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();

      if (!res.ok || !data?.authenticated) {
        const expiredRole = (data?.role || this.getTabRole() || 'user') as 'user' | 'admin';
        this.clearTabAuthenticated();
        this.handleSessionExpired(!!data?.expired, expiredRole);
      } else {
        const currentRole = (data?.role || 'user') as 'user' | 'admin';
        this.setTabAuthenticated(currentRole);
      }
    } catch {
      // Don't interrupt on temporary network drop; only react when server explicitly reports invalid
    } finally {
      this.isCheckingSession = false;
    }
  }

  private handleSessionExpired(isExpired = false, role: 'user' | 'admin' = 'user'): void {
    if (this.currentAuthGate || this.currentAdminModal || document.getElementById('auth-gate') || document.getElementById('admin-login-modal')) {
      return;
    }

    if (role === 'admin') {
      const message = isExpired
        ? 'Your admin session has expired. Please log in again.'
        : undefined;

      this.currentAdminModal = new AdminLoginModal(
        () => {
          this.currentAdminModal = null;
          this.setTabAuthenticated('admin');
          if (!this.isMounted) {
            this.mountTour();
          }
        },
        () => {
          this.currentAdminModal = null;
          // Fall back to AuthGate if admin dialog is dismissed
          this.handleSessionExpired(false, 'user');
        },
        message
      );
      return;
    }

    const message = isExpired
      ? 'Your session has expired. Please authenticate again.'
      : undefined;

    this.currentAuthGate = new AuthGate((authedRole) => {
      this.currentAuthGate = null;
      this.setTabAuthenticated(authedRole || 'user');
      if (!this.isMounted) {
        this.mountTour();
      }
    }, message);
  }

  private async initAuthAndMount(): Promise<void> {
    this.setupSessionLifecycle();

    // Check if user requested admin screen directly or via recent admin logout
    const openAdminOnLoad = sessionStorage.getItem('openAdminOnLoad') === 'true';
    if (openAdminOnLoad) {
      sessionStorage.removeItem('openAdminOnLoad');
      this.handleSessionExpired(false, 'admin');
      return;
    }

    try {
      const res = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache', 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();

      const serverAuthed = res.ok && !!data?.authenticated;
      const tabAuthed = this.isTabAuthenticated();
      const serverRole = (data?.role || 'user') as 'user' | 'admin';

      if (serverAuthed && tabAuthed) {
        // Both valid server session AND current tab marker exist:
        // Set role and allow immediate entry (persists across page reloads in the same tab)
        this.setTabAuthenticated(serverRole);
        this.mountTour();
      } else {
        // If server session is invalid or expired, clear any stale tab marker
        if (!serverAuthed) {
          this.clearTabAuthenticated();
        }
        const targetRole = (data?.role || this.getTabRole() || 'user') as 'user' | 'admin';
        this.handleSessionExpired(serverAuthed ? false : !!data?.expired, targetRole);
      }
    } catch {
      // Fallback to AuthGate on network or unverified states
      this.handleSessionExpired(false, 'user');
    }
  }

  private async mountTour(): Promise<void> {
    if (this.isMounted) return;
    this.isMounted = true;

    const viewportContainer = document.getElementById('tour-viewport');

    if (!viewportContainer) {
      throw new Error('Required DOM container #tour-viewport missing.');
    }

    // 5. Initialize 360 Three.js Viewer
    this.viewer = new Viewer360(viewportContainer);

    // 6. Mount Orientation Prompt (Phone Portrait Lock)
    new OrientationPrompt();

    // 7. Mount Intro Screen & UI elements
    this.introScreen = new IntroScreen();
    new LoadingIndicator();
    new TopBar();
    this.sliderNav = new iPhoneSliderNav();
    new FloorPlan();
    new ScatteredGallery();
    new Lightbox();
    new ContactModal();
    new LocationModal();
    new ControlMenu();

    // 8. Load initial room (Living Room)
    try {
      await this.viewer.initFirstRoom();
      this.introScreen.notifyFirstRoomReady();
    } catch (err) {
      console.error('Failed to load initial room panorama:', err);
      this.introScreen.notifyFirstRoomReady();
    }
  }

  public static start(): TourApp {
    if (!TourApp.instance) {
      TourApp.instance = new TourApp();
    }
    return TourApp.instance;
  }
}

// Global window mount API for embed mode (Section 69)
declare global {
  interface Window {
    PropertyTour: {
      app?: TourApp;
      mount: () => TourApp;
      getState: () => TourState;
    };
  }
}

window.PropertyTour = {
  mount: () => TourApp.start(),
  getState: () => TourState.get()
};

// Auto-start on standalone DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.PropertyTour.app = TourApp.start();
  });
} else {
  window.PropertyTour.app = TourApp.start();
}
