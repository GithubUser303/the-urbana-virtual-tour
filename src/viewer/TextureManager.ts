import * as THREE from 'three';

export interface LoadTextureOptions {
  priority?: 'high' | 'low' | 'auto';
  fallbackUrl?: string;
  onProgress?: (progress: number) => void;
}

export class TextureManager {
  private cache: Map<string, THREE.Texture> = new Map();
  private loadingPromises: Map<string, Promise<THREE.Texture>> = new Map();

  /**
   * Load a texture asynchronously with off-main-thread image decoding and fetchPriority
   */
  public async loadTexture(
    url: string,
    options: LoadTextureOptions = {}
  ): Promise<THREE.Texture> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const { priority = 'auto', fallbackUrl } = options;

    const promise = (async () => {
      try {
        const texture = await this.fetchAndDecodeTexture(url, priority);
        this.cache.set(url, texture);
        return texture;
      } catch (primaryErr) {
        if (fallbackUrl && fallbackUrl !== url) {
          console.warn(`Primary texture ${url} failed, attempting fallback ${fallbackUrl}`);
          try {
            const fallbackTex = await this.fetchAndDecodeTexture(fallbackUrl, priority);
            this.cache.set(url, fallbackTex);
            return fallbackTex;
          } catch (fallbackErr) {
            console.error(`Fallback texture failed as well for ${fallbackUrl}:`, fallbackErr);
            throw fallbackErr;
          }
        }
        throw primaryErr;
      } finally {
        this.loadingPromises.delete(url);
      }
    })();

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Fetch image with priority and decode off-main-thread before uploading to WebGL
   */
  private async fetchAndDecodeTexture(
    url: string,
    priority: 'high' | 'low' | 'auto'
  ): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      if ('fetchPriority' in img) {
        (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = priority;
      }

      img.onload = async () => {
        try {
          if ('decode' in img) {
            await img.decode();
          }
          const texture = new THREE.Texture(img);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;
          resolve(texture);
        } catch (err) {
          // If decode fails, still attempt to construct texture from loaded image
          const texture = new THREE.Texture(img);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;
          resolve(texture);
        }
      };

      img.onerror = (err) => {
        reject(err);
      };

      img.src = url;
    });
  }

  public hasTexture(url: string): boolean {
    return this.cache.has(url);
  }

  public getCachedTexture(url: string): THREE.Texture | undefined {
    return this.cache.get(url);
  }

  public clear(): void {
    this.cache.forEach((tex) => tex.dispose());
    this.cache.clear();
    this.loadingPromises.clear();
  }
}
