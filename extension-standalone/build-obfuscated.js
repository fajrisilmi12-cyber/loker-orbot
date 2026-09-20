#!/usr/bin/env node
/**
 * Build script: obfuscate extension-standalone/ → extension-standalone-dist/
 *
 * Usage:
 *   npm install --save-dev javascript-obfuscator   (one-time)
 *   node extension-standalone/build-obfuscated.js
 *
 * Output: extension-standalone-dist/  (load THIS folder in Chrome, not the source)
 *
 * What gets obfuscated:  *.js files (background, popup, content_scripts)
 * What gets copied as-is: manifest.json, *.html, *.css, icons/
 */

const fs   = require('fs');
const path = require('path');

let JavaScriptObfuscator;
try {
  JavaScriptObfuscator = require('javascript-obfuscator');
} catch {
  console.error('\n❌  javascript-obfuscator not installed.');
  console.error('    Run: npm install --save-dev javascript-obfuscator\n');
  process.exit(1);
}

const SRC  = path.resolve(__dirname);
const DIST = path.resolve(__dirname, '..', 'extension-standalone-dist');

// Obfuscation preset — balanced for Chrome extension service workers.
// Avoid string-array-calls-transform in MV3 service workers (breaks async timing).
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  debugProtection: false,         // Breaks DevTools — leave off for extension review
  disableConsoleOutput: true,
  identifierNamesGenerator: 'mangled',
  renameGlobals: false,           // Keep chrome.* and browser globals intact
  selfDefending: false,           // Service workers don't support self-defending patterns
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: false,     // Safer for chrome.runtime.sendMessage key matching
  unicodeEscapeSequence: false,
};

// Files/dirs to copy verbatim (no obfuscation)
const COPY_AS_IS = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'content_scripts/floating_assistant.css',
  'icons',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function obfuscateJs(srcFile, destFile) {
  const code = fs.readFileSync(srcFile, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
  fs.writeFileSync(destFile, result.getObfuscatedCode(), 'utf8');
}

function processDir(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      processDir(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      console.log(`  🔒 obfuscating  ${path.relative(SRC, srcPath)}`);
      obfuscateJs(srcPath, destPath);
    } else {
      // Non-JS: copy verbatim
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n🔨  Building obfuscated extension...\n');

// Clean dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
ensureDir(DIST);

// Process all files in SRC
processDir(SRC, DIST);

// Remove build script itself from dist (don't ship it)
const distBuildScript = path.join(DIST, 'build-obfuscated.js');
if (fs.existsSync(distBuildScript)) fs.rmSync(distBuildScript);

const fileCount = fs.readdirSync(DIST, { recursive: true })
  .filter(f => !fs.statSync(path.join(DIST, f)).isDirectory()).length;

console.log(`\n✅  Done — ${fileCount} files written to:\n    ${DIST}`);
console.log('\n📦  Load this folder in Chrome: chrome://extensions → Load unpacked\n');
