import * as THREE from 'three';

export class TextureManager {
  private loader: THREE.TextureLoader;
  private cache: Map<string, THREE.Texture> = new Map();
  private loadingPromises: Map<string, Promise<THREE.Texture>> = new Map();

  constructor() {
    this.loader = new THREE.TextureLoader();
  }

  public async loadTexture(url: string, onProgress?: (progress: number) => void): Promise<THREE.Texture> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;

          this.cache.set(url, texture);
          this.loadingPromises.delete(url);
          resolve(texture);
        },
        (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(event.loaded / event.total);
          }
        },
        (err) => {
          this.loadingPromises.delete(url);
          console.error(`Failed to load texture at ${url}:`, err);
          reject(err);
        }
      );
    });

    this.loadingPromises.set(url, loadPromise);
    return loadPromise;
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

