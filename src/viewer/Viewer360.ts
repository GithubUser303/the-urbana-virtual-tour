import * as THREE from 'three';
import { TourState } from '../state/TourState';
import { CameraControl } from './CameraControl';
import { TextureManager } from './TextureManager';
import { RoomPreloader } from './RoomPreloader';

export class Viewer360 {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraControl: CameraControl;
  private textureManager: TextureManager;
  private roomPreloader: RoomPreloader;
  private tourState: TourState;

  // Dual spherical meshes for cinematic crossfade
  private sphereMeshA: THREE.Mesh;
  private sphereMeshB: THREE.Mesh;
  private materialA: THREE.MeshBasicMaterial;
  private materialB: THREE.MeshBasicMaterial;
  private activeSphere: 'A' | 'B' = 'A';

  // Crossfade transition state
  private isCrossfading = false;
  private crossfadeStartTime = 0;
  private crossfadeDuration = 800; // ms

  private rafId: number | null = null;
  private isDestroyed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.tourState = TourState.get();
    this.textureManager = new TextureManager();
    this.roomPreloader = new RoomPreloader(this.tourState.getConfig(), this.textureManager);

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1500);
    this.camera.position.set(0, 0, 0);

    // 3. Renderer with clamped DPR for mobile and GPU safety
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // 4. Sphere Meshes: Invert geometry along x-axis for unmirrored inside-facing equirectangular projection
    const sphereGeo = new THREE.SphereGeometry(500, 64, 40);
    sphereGeo.scale(-1, 1, 1);

    this.materialA = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.materialB = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.sphereMeshA = new THREE.Mesh(sphereGeo, this.materialA);
    this.sphereMeshB = new THREE.Mesh(sphereGeo, this.materialB);

    this.scene.add(this.sphereMeshA);
    this.scene.add(this.sphereMeshB);

    // 5. Controls
    this.cameraControl = new CameraControl(this.camera, container);

    // 6. Resize handling
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);

    // 7. Subscribe to room changes
    this.tourState.on('roomChange', () => {
      this.loadRoom(this.tourState.getState().currentRoomId);
    });

    // 8. Start loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  public async initFirstRoom(): Promise<void> {
    const currentRoom = this.tourState.getCurrentRoom();
    // Set initial camera orientation (invert yaw to match un-mirrored panorama coordinate system)
    this.cameraControl.setOrientation(
      -currentRoom.initialCamera.yaw,
      currentRoom.initialCamera.pitch,
      currentRoom.initialCamera.fov,
      true
    );

    // Fast initial start: if preview is available, load it immediately
    if (currentRoom.panorama.preview) {
      try {
        const previewTex = await this.textureManager.loadTexture(currentRoom.panorama.preview, {
          priority: 'high'
        });
        if (this.activeSphere === 'A') {
          this.materialA.map = previewTex;
          this.materialA.needsUpdate = true;
          this.materialA.opacity = 1.0;
        }
      } catch (_) {}
    }

    // Load full-resolution standard texture
    const texture = await this.textureManager.loadTexture(currentRoom.panorama.standard, {
      priority: 'high',
      fallbackUrl: currentRoom.panorama.fallback
    });
    this.materialA.map = texture;
    this.materialA.needsUpdate = true;
    this.materialA.opacity = 1.0;
    this.materialB.opacity = 0.0;
    this.activeSphere = 'A';

    // Intelligently preload adjacent rooms in background
    this.roomPreloader.preloadAdjacentRooms(currentRoom.id);
  }

  public async loadRoom(roomId: string): Promise<void> {
    const room = this.tourState.getConfig().rooms[roomId];
    if (!room) return;

    // Aggressive caching: if texture is already cached, bypass loader indicator completely
    const isCached = this.textureManager.hasTexture(room.panorama.standard);
    if (!isCached) {
      this.tourState.setRoomLoading(true, room.name);
    }

    try {
      const texture = await this.textureManager.loadTexture(room.panorama.standard, {
        priority: 'high',
        fallbackUrl: room.panorama.fallback
      });

      if (!isCached) {
        this.tourState.setRoomLoading(false);
      }

      // Smoothly orient camera toward room's preferred angle (invert yaw for un-mirrored space)
      this.cameraControl.setOrientation(
        -room.initialCamera.yaw,
        room.initialCamera.pitch,
        room.initialCamera.fov,
        false
      );

      // Execute dual-mesh crossfade
      this.startCrossfade(texture);

      // Intelligently preload adjacent rooms in background
      this.roomPreloader.preloadAdjacentRooms(roomId);
    } catch (err) {
      this.tourState.setRoomLoading(false);
      console.error(`Error loading room ${roomId}:`, err);
    }
  }

  private startCrossfade(newTexture: THREE.Texture): void {
    if (this.activeSphere === 'A') {
      this.materialB.map = newTexture;
      this.materialB.needsUpdate = true;
      this.materialB.opacity = 0.0;
      this.materialA.opacity = 1.0;
    } else {
      this.materialA.map = newTexture;
      this.materialA.needsUpdate = true;
      this.materialA.opacity = 0.0;
      this.materialB.opacity = 1.0;
    }

    this.isCrossfading = true;
    this.crossfadeStartTime = performance.now();
  }

  private updateCrossfade(): void {
    if (!this.isCrossfading) return;

    const elapsed = performance.now() - this.crossfadeStartTime;
    const progress = Math.min(1, elapsed / this.crossfadeDuration);
    // Smooth cosine interpolation
    const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);

    if (this.activeSphere === 'A') {
      this.materialA.opacity = 1.0 - t;
      this.materialB.opacity = t;
      if (progress >= 1) {
        this.materialA.opacity = 0.0;
        this.materialB.opacity = 1.0;
        this.activeSphere = 'B';
        this.isCrossfading = false;
      }
    } else {
      this.materialB.opacity = 1.0 - t;
      this.materialA.opacity = t;
      if (progress >= 1) {
        this.materialB.opacity = 0.0;
        this.materialA.opacity = 1.0;
        this.activeSphere = 'A';
        this.isCrossfading = false;
      }
    }
  }

  public resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, true);
  }

  private onWindowResize(): void {
    this.resize();
  }

  private animate(): void {
    if (this.isDestroyed) return;

    this.cameraControl.update();
    this.updateCrossfade();
    this.renderer.render(this.scene, this.camera);

    this.rafId = requestAnimationFrame(this.animate);
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getCameraControl(): CameraControl {
    return this.cameraControl;
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);

    this.textureManager.clear();
    this.materialA.dispose();
    this.materialB.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.remove();
    }
  }
}

