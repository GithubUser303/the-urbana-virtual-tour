export interface HotspotConfig {
  id: string;
  targetRoomId: string;
  label: string;
  icon: string; // path to hotspot PNG
  yaw: number; // in degrees [-180, 180]
  pitch: number; // in degrees [-90, 90]
  minPitch?: number;
  maxPitch?: number;
}

export interface RoomConfig {
  id: string;
  name: string;
  panorama: {
    preview?: string;
    standard: string;
    high?: string;
  };
  initialCamera: {
    yaw: number; // in degrees
    pitch: number; // in degrees
    fov: number; // in degrees
  };
  hotspots: HotspotConfig[];
  adjacentRooms: string[];
  floorPlanCoords: {
    top: string;
    left: string;
    yawOffset: number; // degrees offset for radar cone
  };
}

export interface GalleryPhoto {
  url: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface GalleryItem {
  id: string;
  roomId: string;
  title: string;
  photos: GalleryPhoto[];
  isPlaceholder?: boolean;
  // Spatial layout settings for scattered Apple Watch style arrangement
  scatterPreset: {
    x: number; // percentage from center [-50, 50]
    y: number; // percentage from center [-50, 50]
    rotate: number; // base rotation in degrees
    width: number; // width in rem or px
    height: number;
    zIndex: number;
    windPeriod: number; // seconds for wind cycle
    windPhase: number; // phase offset in radians
  };
}

export interface PropertyConfig {
  projectName: string;
  credits: string;
  projectFont?: string;
  defaultRoomId: string;
  contact: {
    company: string;
    email: string;
    phone: string;
    address?: string;
  };
  location: {
    latitude: number;
    longitude: number;
    zoom: number;
    displayName: string;
  };
  floorPlan: {
    name: string;
    image: string;
    aspectRatio: number;
  };
  audio: {
    enabled: boolean;
    src: string;
    defaultVolume: number;
  };
  rooms: Record<string, RoomConfig>;
  gallery: GalleryItem[];
}

