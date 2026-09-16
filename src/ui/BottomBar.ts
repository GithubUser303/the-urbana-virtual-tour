import { TourState } from '../state/TourState';

export class BottomBar {
  private element: HTMLElement;
  private tourState: TourState;
  private roomButtons: Map<string, HTMLButtonElement> = new Map();

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('roomChange', (state) => {
      this.updateActiveRoom(state.currentRoomId);
    });

    this.tourState.on('uiVisibilityChange', (state) => {
      if (state.isUiHidden) {
        this.element.classList.add('ui-hidden-bottom');
      } else {
        this.element.classList.remove('ui-hidden-bottom');
      }
    });

    this.updateActiveRoom(this.tourState.getState().currentRoomId);
  }

  private createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.id = 'bottom-bar-wrapper';
    wrapper.className = 'bottom-bar-wrapper';

    // The dock panel
    const bar = document.createElement('nav');
    bar.id = 'bottom-bar';
    bar.className = 'bottom-bar glass-panel';

    const config = this.tourState.getConfig();
    const rooms = Object.values(config.rooms);

    // Room buttons
    rooms.forEach((room) => {
      const btn = document.createElement('button');
      btn.className = 'room-nav-btn glass-interactive';
      btn.setAttribute('data-room-id', room.id);
      btn.textContent = room.name;

      btn.addEventListener('click', () => {
        this.tourState.setRoom(room.id);
      });

      this.roomButtons.set(room.id, btn);
      bar.appendChild(btn);
    });

    // Divider
    const divider = document.createElement('div');
    divider.className = 'bottom-bar-divider';
    bar.appendChild(divider);

    // Location button
    const locationBtn = document.createElement('button');
    locationBtn.className = 'room-nav-btn location-btn glass-interactive';
    locationBtn.setAttribute('aria-label', 'Open property location map');
    locationBtn.innerHTML = `
      <svg class="location-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span>Location</span>
    `;

    locationBtn.addEventListener('click', () => {
      this.tourState.openModal('location');
    });

    bar.appendChild(locationBtn);
    wrapper.appendChild(bar);

    // Exact credits text directly below bottom bar
    const credits = document.createElement('div');
    credits.className = 'credits-text';
    credits.textContent = config.credits; // "Experience by Lost in Renders"
    wrapper.appendChild(credits);

    return wrapper;
  }

  private updateActiveRoom(roomId: string): void {
    this.roomButtons.forEach((btn, id) => {
      if (id === roomId) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'true');
        // Ensure visible in horizontal scroll on mobile
        btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      } else {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      }
    });
  }
}

