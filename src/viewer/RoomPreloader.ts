import { PropertyConfig } from '../config/types';
import { TextureManager } from './TextureManager';

export class RoomPreloader {
  private config: PropertyConfig;
  private textureManager: TextureManager;
  private preloadedRooms: Set<string> = new Set();
  private queue: string[] = [];
  private isProcessing = false;

  constructor(config: PropertyConfig, textureManager: TextureManager) {
    this.config = config;
    this.textureManager = textureManager;
  }

  public preloadAdjacentRooms(currentRoomId: string): void {
    const currentRoom = this.config.rooms[currentRoomId];
    if (!currentRoom) return;

    // Collect adjacent rooms that haven't been preloaded yet
    const toPreload = currentRoom.adjacentRooms.filter(
      (id) => !this.preloadedRooms.has(id) && !this.queue.includes(id)
    );

    // Prioritize adjacent rooms at head of queue
    this.queue = [...toPreload, ...this.queue];
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const nextRoomId = this.queue.shift()!;
    const room = this.config.rooms[nextRoomId];

    if (room && !this.preloadedRooms.has(nextRoomId)) {
      try {
        const url = room.panorama.standard;
        if (!this.textureManager.hasTexture(url)) {
          // Use idle delay to avoid competing with main render
          await new Promise((resolve) => setTimeout(resolve, 400));
          await this.textureManager.loadTexture(url, {
            priority: 'low',
            fallbackUrl: room.panorama.fallback
          });
        }
        this.preloadedRooms.add(nextRoomId);
      } catch (err) {
        console.warn(`Failed to background preload room ${nextRoomId}:`, err);
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}

