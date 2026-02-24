const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const helpDir = path.join(rootDir, "frontend", "public", "help");

const locales = ["ru", "en"];
const files = ["functional-overview.md", "workflows.md", "screenshots-checklist.md"];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function transformForEmbeddedHelp(content) {
  return content
    .replace(/\.\.\/assets\/ru\//g, "/help/assets/ru/")
    .replace(/\.\.\/assets\/en\//g, "/help/assets/en/")
    .replace(/docs\/assets\/ru\//g, "frontend/public/help/assets/ru/")
    .replace(/docs\/assets\/en\//g, "frontend/public/help/assets/en/");
}

function copyLocaleDocs(locale) {
  const srcLocaleDir = path.join(docsDir, locale);
  const dstLocaleDir = path.join(helpDir, locale);
  ensureDir(dstLocaleDir);

  for (const fileName of files) {
    const srcFile = path.join(srcLocaleDir, fileName);
    const dstFile = path.join(dstLocaleDir, fileName);

    if (!fs.existsSync(srcFile)) {
      throw new Error(`Missing source doc file: ${srcFile}`);
    }

    const srcText = fs.readFileSync(srcFile, "utf8");
    const outText = transformForEmbeddedHelp(srcText);
    fs.writeFileSync(dstFile, outText, "utf8");
  }
}

function copyAssets(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) return;
  ensureDir(destDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyAssets(srcPath, dstPath);
    } else if (entry.isFile() && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(entry.name)) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function syncAssetFolders() {
  const srcRuAssets = path.join(docsDir, "assets", "ru");
  const srcEnAssets = path.join(docsDir, "assets", "en");
  const dstRuAssets = path.join(helpDir, "assets", "ru");
  const dstEnAssets = path.join(helpDir, "assets", "en");

  ensureDir(dstRuAssets);
  ensureDir(dstEnAssets);
  copyAssets(srcRuAssets, dstRuAssets);
  copyAssets(srcEnAssets, dstEnAssets);

  const ruGitkeep = path.join(dstRuAssets, ".gitkeep");
  const enGitkeep = path.join(dstEnAssets, ".gitkeep");
  if (!fs.existsSync(ruGitkeep)) fs.writeFileSync(ruGitkeep, "");
  if (!fs.existsSync(enGitkeep)) fs.writeFileSync(enGitkeep, "");
}

function main() {
  for (const locale of locales) {
    copyLocaleDocs(locale);
  }
  syncAssetFolders();
  console.log("[docs] Embedded help docs synced to frontend/public/help");
}

main();
