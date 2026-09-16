import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TourState } from '../state/TourState';

export class LocationModal {
  private element: HTMLElement;
  private tourState: TourState;
  private mapContainer!: HTMLElement;
  private map: L.Map | null = null;
  private isOpen = false;

  constructor() {
    this.tourState = TourState.get();
    this.element = this.createElement();
    document.body.appendChild(this.element);

    this.tourState.on('modalChange', (state) => {
      if (state.activeModal === 'location') {
        this.show();
      } else if (this.isOpen) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.tourState.closeModal();
      }
    });
  }

  private createElement(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'location-modal-backdrop';
    backdrop.className = 'modal-backdrop location-backdrop';
    backdrop.style.display = 'none';

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.tourState.closeModal();
      }
    });

    const card = document.createElement('div');
    card.className = 'location-modal-card glass-panel';

    const header = document.createElement('div');
    header.className = 'modal-card-header';

    const title = document.createElement('h3');
    title.className = 'modal-card-title';
    title.textContent = 'Property Location';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-card-close glass-interactive';
    closeBtn.setAttribute('aria-label', 'Close location map');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => {
      this.tourState.closeModal();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Map container
    this.mapContainer = document.createElement('div');
    this.mapContainer.className = 'location-map-inner';

    const footer = document.createElement('div');
    footer.className = 'location-modal-footer';
    const loc = this.tourState.getConfig().location;
    footer.textContent = `${loc.displayName} (approx. coordinates: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`;

    card.appendChild(header);
    card.appendChild(this.mapContainer);
    card.appendChild(footer);
    backdrop.appendChild(card);

    return backdrop;
  }

  private initMap(): void {
    if (this.map) return;

    const loc = this.tourState.getConfig().location;
    this.map = L.map(this.mapContainer, {
      center: [loc.latitude, loc.longitude],
      zoom: loc.zoom,
      zoomControl: true,
      attributionControl: false
    });

    // Dark cartographic tiles for architectural aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Custom glowing property marker
    const customIcon = L.divIcon({
      className: 'map-property-pin',
      html: `
        <div class="pin-pulse"></div>
        <div class="pin-dot"></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([loc.latitude, loc.longitude], { icon: customIcon })
      .addTo(this.map)
      .bindPopup(`<strong>the Urbana</strong><br>${loc.displayName}`)
      .openPopup();
  }

  public show(): void {
    this.isOpen = true;
    this.element.style.display = 'flex';
    requestAnimationFrame(() => {
      this.element.classList.add('active');
      this.initMap();
      if (this.map) {
        setTimeout(() => {
          this.map?.invalidateSize();
        }, 200);
      }
    });
  }

  public hide(): void {
    this.isOpen = false;
    this.element.classList.remove('active');
    setTimeout(() => {
      if (!this.isOpen) {
        this.element.style.display = 'none';
      }
    }, 350);
  }
}

