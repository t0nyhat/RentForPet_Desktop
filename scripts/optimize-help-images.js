#!/usr/bin/env node
/**
 * Optimize PNG images in help documentation
 * Reduces file size while maintaining quality
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(
  __dirname,
  "..",
  "frontend",
  "public",
  "help",
  "assets",
);
const LANGS = ["ru", "en"];
const MAX_WIDTH = 1920; // Maximum width in pixels
const QUALITY = 85; // PNG compression quality

async function optimizeImage(filePath) {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const originalSize = fs.statSync(filePath).size;

    // Resize if wider than MAX_WIDTH
    let pipeline = image.clone();
    if (metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    // Optimize PNG
    pipeline = pipeline.png({
      compressionLevel: 9,
      quality: QUALITY,
      effort: 10,
    });

    // Write to temporary file first
    const tempFile = filePath + ".tmp";
    await pipeline.toFile(tempFile);

    const newSize = fs.statSync(tempFile).size;
    const savedPercent = (
      ((originalSize - newSize) / originalSize) *
      100
    ).toFixed(1);

    // Only replace if smaller
    if (newSize < originalSize) {
      fs.renameSync(tempFile, filePath);
      console.log(
        `✓ ${path.basename(filePath)}: ${(originalSize / 1024).toFixed(1)} KB → ${(newSize / 1024).toFixed(1)} KB (saved ${savedPercent}%)`,
      );
    } else {
      fs.unlinkSync(tempFile);
      console.log(`○ ${path.basename(filePath)}: already optimized`);
    }
  } catch (error) {
    console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
  }
}

async function optimizeDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));

  if (pngFiles.length === 0) {
    console.log(`No PNG files found in ${dirPath}`);
    return;
  }

  console.log(
    `\nOptimizing ${pngFiles.length} images in ${path.basename(dirPath)}...\n`,
  );

  for (const file of pngFiles) {
    await optimizeImage(path.join(dirPath, file));
  }
}

async function main() {
  console.log("Help Documentation Image Optimizer\n");
  console.log(`Max width: ${MAX_WIDTH}px, Quality: ${QUALITY}%\n`);

  for (const lang of LANGS) {
    const langDir = path.join(ASSETS_DIR, lang);
    if (fs.existsSync(langDir)) {
      await optimizeDirectory(langDir);
    } else {
      console.log(`Directory not found: ${langDir}`);
    }
  }

  console.log("\n✓ Optimization complete!");
}

main().catch(console.error);
