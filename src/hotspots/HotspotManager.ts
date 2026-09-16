import * as THREE from 'three';
import { TourState } from '../state/TourState';
import { HotspotView } from './HotspotView';

export class HotspotManager {
  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private tourState: TourState;
  private activeHotspots: HotspotView[] = [];
  private hotspotWorldPositions: Map<HotspotView, THREE.Vector3> = new Map();
  private rafId: number | null = null;
  private isDestroyed = false;

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.container = container;
    this.camera = camera;
    this.tourState = TourState.get();

    this.rebuildHotspots = this.rebuildHotspots.bind(this);
    this.update = this.update.bind(this);

    this.tourState.on('roomChange', this.rebuildHotspots);
    this.rebuildHotspots();
    this.update();
  }

  public rebuildHotspots(): void {
    // Clear existing
    this.activeHotspots.forEach((h) => h.destroy());
    this.activeHotspots = [];
    this.hotspotWorldPositions.clear();

    const currentRoom = this.tourState.getCurrentRoom();
    if (!currentRoom || !currentRoom.hotspots) return;

    const sphereRadius = 450; // Inside 500 sphere

    currentRoom.hotspots.forEach((config) => {
      const view = new HotspotView(config);
      this.container.appendChild(view.element);
      this.activeHotspots.push(view);

      // Convert spherical yaw & pitch to 3D world coordinates
      // Invert yaw to match un-mirrored panorama orientation
      const phi = THREE.MathUtils.degToRad(90 - config.pitch);
      const theta = THREE.MathUtils.degToRad(-config.yaw);

      const pos = new THREE.Vector3(
        sphereRadius * Math.sin(phi) * Math.sin(theta),
        sphereRadius * Math.cos(phi),
        sphereRadius * Math.sin(phi) * Math.cos(theta)
      );

      this.hotspotWorldPositions.set(view, pos);
    });
  }

  private update(): void {
    if (this.isDestroyed) return;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const halfW = width / 2;
    const halfH = height / 2;

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    this.activeHotspots.forEach((hotspot) => {
      const worldPos = this.hotspotWorldPositions.get(hotspot);
      if (!worldPos) return;

      // Check Level 1 facing / occlusion angle: vector must be in front of camera
      const toHotspot = worldPos.clone().normalize();
      const dot = camDir.dot(toHotspot);

      // If hotspot is behind camera, hide it
      if (dot <= 0.1) {
        hotspot.setScreenPosition(0, 0, false);
        return;
      }

      // Project 3D vector to Normalized Device Coordinates (NDC) [-1, 1]
      const screenVec = worldPos.clone().project(this.camera);

      // Visible check inside camera frustum (with comfortable margins)
      const isInsideFrustum =
        screenVec.z < 1 &&
        screenVec.x >= -1.15 &&
        screenVec.x <= 1.15 &&
        screenVec.y >= -1.15 &&
        screenVec.y <= 1.15;

      if (!isInsideFrustum) {
        hotspot.setScreenPosition(0, 0, false);
        return;
      }

      // Convert NDC to pixel screen coordinates
      const screenX = screenVec.x * halfW + halfW;
      const screenY = -(screenVec.y * halfH) + halfH;

      hotspot.setScreenPosition(screenX, screenY, true);
    });

    this.rafId = requestAnimationFrame(this.update);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.activeHotspots.forEach((h) => h.destroy());
    this.activeHotspots = [];
    this.hotspotWorldPositions.clear();
  }
}

