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

  private async initAuthAndMount(): Promise<void> {
    try {
      const res = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();

      if (res.ok && data.authenticated) {
        // Already authenticated session
        this.mountTour();
      } else {
        // Display secure TOTP access gate
        new AuthGate(() => {
          this.mountTour();
        });
      }
    } catch {
      // Fallback to AuthGate on network or unverified states
      new AuthGate(() => {
        this.mountTour();
      });
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
