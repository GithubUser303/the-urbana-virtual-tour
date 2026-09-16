import { TourState } from '../state/TourState';

export class FloorPlan {
  private element: HTMLElement;
  private tourState: TourState;
  private isExpanded = false;
  private isMinimized = false;
  private currentRoomLabel!: HTMLElement;
  private roomRegions: Map<string, SVGElement> = new Map();
  private mapHotspots: Map<string, HTMLElement> = new Map();

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('roomChange', (state) => {
      this.updateCurrentRoom(state.currentRoomId);
    });

    this.tourState.on('uiVisibilityChange', (state) => {
      if (state.isUiHidden) {
        this.element.classList.add('ui-hidden-corner');
      } else {
        this.element.classList.remove('ui-hidden-corner');
      }
    });

    this.updateCurrentRoom(this.tourState.getState().currentRoomId);
  }

  private createElement(): HTMLElement {
    const container = document.createElement('aside');
    container.id = 'floorplan-panel';
    container.className = 'floorplan-panel glass-panel';
    container.setAttribute('aria-label', 'Interactive floor plan');

    // Header (always visible in collapsed state)
    const header = document.createElement('div');
    header.className = 'floorplan-header glass-interactive';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'floorplan-title-group';

    const title = document.createElement('span');
    title.className = 'floorplan-title';
    title.textContent = this.tourState.getConfig().floorPlan.name; // "FLOOR PLAN"

    this.currentRoomLabel = document.createElement('span');
    this.currentRoomLabel.className = 'floorplan-current-room';
    this.currentRoomLabel.textContent = this.tourState.getCurrentRoom().name;

    titleGroup.appendChild(title);
    titleGroup.appendChild(this.currentRoomLabel);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'floorplan-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle floor plan view');
    toggleBtn.innerHTML = `
      <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;

    header.appendChild(titleGroup);
    header.appendChild(toggleBtn);

    // Body (holds the blueprint and interactive regions)
    const body = document.createElement('div');
    body.className = 'floorplan-body';

    const blueprintWrapper = document.createElement('div');
    blueprintWrapper.className = 'floorplan-blueprint-wrapper';

    // Blueprint background image
    const img = document.createElement('img');
    img.src = this.tourState.getConfig().floorPlan.image;
    img.alt = 'Architectural Floor Plan Blueprint';
    img.className = 'floorplan-image';
    blueprintWrapper.appendChild(img);

    // Interactive SVG overlay matching the blueprint layout (1312 x 1199 native)
    const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgOverlay.setAttribute('viewBox', '0 0 1312 1199');
    svgOverlay.setAttribute('preserveAspectRatio', 'none');
    svgOverlay.setAttribute('class', 'floorplan-svg-overlay');

    // Define room polygon regions corresponding directly to the blueprint image
    const roomPolygons: Record<string, { points: string; label: string }> = {
      // Bedroom 1 (Master)
      master: {
        points: '100,70 485,70 485,440 100,440',
        label: 'Master Bedroom'
      },
      // Bathroom 1
      bathroom: {
        points: '495,70 635,70 635,380 495,380',
        label: 'Bathroom'
      },
      // Living Room
      living: {
        points: '655,70 1170,70 1170,550 655,550',
        label: 'Living Room'
      },
      // Bedroom 2 (Guest)
      guest: {
        points: '100,630 535,630 535,980 100,980',
        label: 'Guest Bedroom'
      },
      // Dining Area
      dining: {
        points: '550,550 925,550 925,870 550,870',
        label: 'Dining'
      },
      // Kitchen Area
      kitchen: {
        points: '935,560 1170,560 1170,870 935,870',
        label: 'Kitchen'
      }
    };

    Object.entries(roomPolygons).forEach(([roomId, data]) => {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', data.points);
      poly.setAttribute('class', `floorplan-poly room-${roomId}`);
      poly.setAttribute('data-room-id', roomId);

      poly.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tourState.setRoom(roomId);
      });

      svgOverlay.appendChild(poly);
      this.roomRegions.set(roomId, poly);
    });

    blueprintWrapper.appendChild(svgOverlay);

    // Room position indicator dots
    const rooms = this.tourState.getConfig().rooms;
    Object.entries(rooms).forEach(([roomId, config]) => {
      const dot = document.createElement('div');
      dot.className = `floorplan-hotspot-dot dot-${roomId}`;
      dot.style.top = config.floorPlanCoords.top;
      dot.style.left = config.floorPlanCoords.left;
      dot.title = config.name;

      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tourState.setRoom(roomId);
      });

      blueprintWrapper.appendChild(dot);
      this.mapHotspots.set(roomId, dot);
    });

    body.appendChild(blueprintWrapper);
    container.appendChild(header);
    container.appendChild(body);

    // Expansion interactions:
    // Desktop hover expands fluidly; mobile click toggles
    container.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches && !this.isMinimized) {
        this.expand();
      }
    });

    container.addEventListener('mouseleave', () => {
      if (window.matchMedia('(hover: hover)').matches && !this.isMinimized) {
        this.collapse();
      }
    });

    header.addEventListener('click', () => {
      if (this.isExpanded) {
        this.collapse();
      } else {
        this.expand();
      }
    });

    return container;
  }

  public expand(): void {
    this.isExpanded = true;
    this.element.classList.add('expanded');
    const chevron = this.element.querySelector('.chevron-icon');
    if (chevron) {
      chevron.classList.add('rotated');
    }
  }

  public collapse(): void {
    this.isExpanded = false;
    this.element.classList.remove('expanded');
    const chevron = this.element.querySelector('.chevron-icon');
    if (chevron) {
      chevron.classList.remove('rotated');
    }
  }

  private updateCurrentRoom(roomId: string): void {
    const room = this.tourState.getConfig().rooms[roomId];
    if (!room) return;

    this.currentRoomLabel.textContent = room.name;

    // Update SVG highlights
    this.roomRegions.forEach((poly, id) => {
      if (id === roomId) {
        poly.classList.add('active');
      } else {
        poly.classList.remove('active');
      }
    });

    // Update hotspot dots
    this.mapHotspots.forEach((dot, id) => {
      if (id === roomId) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
}

