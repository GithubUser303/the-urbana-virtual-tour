import { TourState } from '../state/TourState';

export class IntroScreen {
  private element: HTMLElement;
  private tourState: TourState;
  private isReady = false;
  private minTimeElapsed = false;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    // Minimum cinematic hold (1.6s)
    setTimeout(() => {
      this.minTimeElapsed = true;
      this.checkAndDismiss();
    }, 1600);
  }

  private createElement(): HTMLElement {
    const screen = document.createElement('div');
    screen.id = 'intro-screen';
    screen.className = 'intro-screen';

    // Blurred property backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'intro-backdrop';
    // Use the living room preview
    backdrop.style.backgroundImage = `url('/assets/panoramas/living-room.jpg')`;

    const content = document.createElement('div');
    content.className = 'intro-content';

    const title = document.createElement('h1');
    title.className = 'intro-title project-font-branding';
    title.textContent = this.tourState.getConfig().projectName; // "The Urbana"

    const subtitle = document.createElement('div');
    subtitle.className = 'intro-sub';
    subtitle.textContent = this.tourState.getConfig().credits; // "Experience by Lost in Renders"

    content.appendChild(title);
    content.appendChild(subtitle);
    screen.appendChild(backdrop);
    screen.appendChild(content);

    return screen;
  }

  public notifyFirstRoomReady(): void {
    this.isReady = true;
    this.checkAndDismiss();
  }

  private checkAndDismiss(): void {
    if (this.isReady && this.minTimeElapsed) {
      this.element.classList.add('intro-fade-out');
      setTimeout(() => {
        this.element.remove();
      }, 1200);
    }
  }
}

