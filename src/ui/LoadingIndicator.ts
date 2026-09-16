import { TourState } from '../state/TourState';

export class LoadingIndicator {
  private element: HTMLElement;
  private tourState: TourState;
  private labelElement: HTMLElement;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    this.labelElement = this.element.querySelector('.loading-text')!;
    document.body.appendChild(this.element);

    this.tourState.on('roomLoading', (state) => {
      if (state.isLoadingRoom) {
        this.show(state.loadingRoomName);
      } else {
        this.hide();
      }
    });
  }

  private createElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'room-loading-indicator glass-panel';
    el.style.display = 'none';

    const text = document.createElement('span');
    text.className = 'loading-text';
    text.textContent = 'Loading';

    const spinner = document.createElement('span');
    spinner.className = 'loading-ring';
    spinner.textContent = '◌';

    el.appendChild(text);
    el.appendChild(spinner);
    return el;
  }

  public show(roomName: string): void {
    this.labelElement.textContent = `Loading ${roomName}`;
    this.element.style.display = 'flex';
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
  }

  public hide(): void {
    this.element.classList.remove('visible');
    setTimeout(() => {
      if (!this.element.classList.contains('visible')) {
        this.element.style.display = 'none';
      }
    }, 400);
  }
}

