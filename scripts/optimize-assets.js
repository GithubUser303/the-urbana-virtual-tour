import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('public/assets');
const PANORAMAS_DIR = path.join(ASSETS_DIR, 'panoramas');
const GALLERY_DIR = path.join(ASSETS_DIR, 'gallery');

async function optimizePanoramas() {
  console.log('Optimizing panoramas...');
  const files = fs.readdirSync(PANORAMAS_DIR).filter(f => f.endsWith('.jpg') && !f.includes('(1)'));

  for (const file of files) {
    const baseName = path.basename(file, '.jpg');
    const inputPath = path.join(PANORAMAS_DIR, file);

    // 1. High-resolution WebP (4096 max width, quality 82)
    const highWebpPath = path.join(PANORAMAS_DIR, `${baseName}.webp`);
    if (!fs.existsSync(highWebpPath)) {
      console.log(`Generating high WebP for ${file}...`);
      await sharp(inputPath)
        .resize({ width: 4096, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(highWebpPath);
    }

    // 2. Low-resolution preview WebP (1024 max width, quality 60, blur)
    const previewWebpPath = path.join(PANORAMAS_DIR, `${baseName}-preview.webp`);
    if (!fs.existsSync(previewWebpPath)) {
      console.log(`Generating preview WebP for ${file}...`);
      await sharp(inputPath)
        .resize({ width: 1024, withoutEnlargement: true })
        .webp({ quality: 60, effort: 4 })
        .toFile(previewWebpPath);
    }
  }
}

async function optimizeGallery() {
  console.log('Optimizing gallery photos...');
  const files = fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith('.jpg'));

  for (const file of files) {
    const baseName = path.basename(file, '.jpg');
    const inputPath = path.join(GALLERY_DIR, file);

    // 1. Gallery thumbnail (640 max width, quality 80)
    const thumbWebpPath = path.join(GALLERY_DIR, `${baseName}-thumb.webp`);
    if (!fs.existsSync(thumbWebpPath)) {
      console.log(`Generating thumbnail for ${file}...`);
      await sharp(inputPath)
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(thumbWebpPath);
    }

    // 2. Full-res optimized WebP (1920 max width, quality 85)
    const fullWebpPath = path.join(GALLERY_DIR, `${baseName}.webp`);
    if (!fs.existsSync(fullWebpPath)) {
      console.log(`Generating full WebP for ${file}...`);
      await sharp(inputPath)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toFile(fullWebpPath);
    }
  }
}

async function main() {
  try {
    await optimizePanoramas();
    await optimizeGallery();
    console.log('Asset optimization complete!');
  } catch (err) {
    console.error('Error optimizing assets:', err);
    process.exit(1);
  }
}

main();

