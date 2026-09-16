import { PropertyConfig, RoomConfig } from '../config/types';

export type TourEventType =
  | 'roomChange'
  | 'roomLoading'
  | 'cameraMove'
  | 'uiVisibilityChange'
  | 'modalChange'
  | 'audioChange'
  | 'fullscreenChange'
  | 'gallerySelect';

export type ModalType = 'none' | 'contact' | 'location' | 'gallery' | 'lightbox';

export interface TourStateData {
  currentRoomId: string;
  previousRoomId: string | null;
  isLoadingRoom: boolean;
  loadingRoomName: string;
  isUiHidden: boolean;
  activeModal: ModalType;
  selectedGalleryItemId: string | null;
  selectedPhotoIndex: number;
  isAudioMuted: boolean;
  isFullscreen: boolean;
  cameraYaw: number;
  cameraPitch: number;
  cameraFov: number;
}

export type StateListener = (state: TourStateData) => void;

export class TourState {
  private static instance: TourState;
  private config: PropertyConfig;
  private listeners: Map<TourEventType, Set<StateListener>> = new Map();

  private data: TourStateData;

  private constructor(config: PropertyConfig) {
    this.config = config;
    this.data = {
      currentRoomId: config.defaultRoomId,
      previousRoomId: null,
      isLoadingRoom: false,
      loadingRoomName: '',
      isUiHidden: false,
      activeModal: 'none',
      selectedGalleryItemId: null,
      selectedPhotoIndex: 0,
      isAudioMuted: !config.audio.enabled,
      isFullscreen: false,
      cameraYaw: -(config.rooms[config.defaultRoomId]?.initialCamera.yaw ?? 0),
      cameraPitch: config.rooms[config.defaultRoomId]?.initialCamera.pitch ?? 0,
      cameraFov: config.rooms[config.defaultRoomId]?.initialCamera.fov ?? 75
    };
  }

  public static init(config: PropertyConfig): TourState {
    if (!TourState.instance) {
      TourState.instance = new TourState(config);
    }
    return TourState.instance;
  }

  public static get(): TourState {
    if (!TourState.instance) {
      throw new Error('TourState not initialized. Call TourState.init(config) first.');
    }
    return TourState.instance;
  }

  public getState(): Readonly<TourStateData> {
    return this.data;
  }

  public getCurrentRoom(): RoomConfig {
    return this.config.rooms[this.data.currentRoomId];
  }

  public getConfig(): PropertyConfig {
    return this.config;
  }

  public on(event: TourEventType, listener: StateListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: TourEventType): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => cb(this.data));
    }
  }

  public setRoom(roomId: string): void {
    if (!this.config.rooms[roomId]) {
      console.warn(`Room ${roomId} does not exist in configuration.`);
      return;
    }
    if (this.data.currentRoomId === roomId && !this.data.isLoadingRoom) {
      return;
    }
    this.data.previousRoomId = this.data.currentRoomId;
    this.data.currentRoomId = roomId;
    this.emit('roomChange');
  }

  public setRoomLoading(isLoading: boolean, roomName = ''): void {
    this.data.isLoadingRoom = isLoading;
    this.data.loadingRoomName = roomName;
    this.emit('roomLoading');
  }

  public updateCamera(yaw: number, pitch: number, fov: number): void {
    this.data.cameraYaw = yaw;
    this.data.cameraPitch = pitch;
    this.data.cameraFov = fov;
    this.emit('cameraMove');
  }

  public toggleUiVisibility(): void {
    this.data.isUiHidden = !this.data.isUiHidden;
    this.emit('uiVisibilityChange');
  }

  public setUiVisibility(hidden: boolean): void {
    if (this.data.isUiHidden !== hidden) {
      this.data.isUiHidden = hidden;
      this.emit('uiVisibilityChange');
    }
  }

  public openModal(modal: ModalType): void {
    this.data.activeModal = modal;
    this.emit('modalChange');
  }

  public closeModal(): void {
    if (this.data.activeModal !== 'none') {
      this.data.activeModal = 'none';
      this.emit('modalChange');
    }
  }

  public openGallery(): void {
    this.openModal('gallery');
  }

  public openLightbox(galleryItemId: string, photoIndex = 0): void {
    this.data.selectedGalleryItemId = galleryItemId;
    this.data.selectedPhotoIndex = photoIndex;
    this.data.activeModal = 'lightbox';
    this.emit('gallerySelect');
    this.emit('modalChange');
  }

  public setLightboxPhotoIndex(index: number): void {
    this.data.selectedPhotoIndex = index;
    this.emit('gallerySelect');
  }

  public setAudioMuted(muted: boolean): void {
    this.data.isAudioMuted = muted;
    this.emit('audioChange');
  }

  public toggleAudio(): void {
    this.setAudioMuted(!this.data.isAudioMuted);
  }

  public setFullscreen(isFullscreen: boolean): void {
    this.data.isFullscreen = isFullscreen;
    this.emit('fullscreenChange');
  }
}

