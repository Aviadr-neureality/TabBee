#!/usr/bin/env node
/**
 * Chrome MV3 extension validator.
 *
 * Checks things that matter for Chrome and that web-ext lint doesn't cover
 * cleanly (it's a Firefox linter by design). Exits 1 if any check fails.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function error(msg)   { errors.push(`  ✗ ${msg}`); }
function warn(msg)    { warnings.push(`  ⚠ ${msg}`); }
function resolve(...p) { return path.join(ROOT, ...p); }
function exists(f)    { return fs.existsSync(resolve(f)); }

// ─── 1. Parse manifest ───────────────────────────────────────────────────────
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(resolve('manifest.json'), 'utf8'));
} catch (e) {
  console.error(`FATAL: cannot parse manifest.json — ${e.message}`);
  process.exit(1);
}

// ─── 2. Required top-level fields ────────────────────────────────────────────
for (const field of ['manifest_version', 'name', 'version', 'description']) {
  if (!manifest[field]) error(`Missing required field: "${field}"`);
}

if (manifest.manifest_version !== 3) {
  error(`manifest_version must be 3, got: ${manifest.manifest_version}`);
}

// ─── 3. Referenced files exist ───────────────────────────────────────────────
const refs = [];

if (manifest.background?.service_worker)
  refs.push(['background.service_worker', manifest.background.service_worker]);

if (manifest.options_ui?.page)
  refs.push(['options_ui.page', manifest.options_ui.page]);

if (manifest.action?.default_popup)
  refs.push(['action.default_popup', manifest.action.default_popup]);

for (const [size, file] of Object.entries(manifest.icons ?? {}))
  refs.push([`icons[${size}]`, file]);

for (const [label, file] of refs) {
  if (!exists(file)) error(`"${label}" references missing file: ${file}`);
}

// ─── 4. Permissions are Chrome-recognised ────────────────────────────────────
const CHROME_PERMISSIONS = new Set([
  'activeTab', 'alarms', 'bookmarks', 'browsingData', 'clipboardRead',
  'clipboardWrite', 'contentSettings', 'contextMenus', 'cookies',
  'debugger', 'declarativeContent', 'declarativeNetRequest',
  'declarativeNetRequestFeedback', 'desktopCapture', 'downloads',
  'enterprise.deviceAttributes', 'enterprise.hardwarePlatform',
  'enterprise.networkingAttributes', 'enterprise.platformKeys',
  'fileBrowserHandler', 'fileSystemProvider', 'fontSettings', 'gcm',
  'geolocation', 'history', 'identity', 'idle', 'loginState',
  'management', 'nativeMessaging', 'notifications', 'offscreen',
  'pageCapture', 'platformKeys', 'power', 'printerProvider', 'printing',
  'printingMetrics', 'privacy', 'processes', 'proxy', 'readingList',
  'runtime', 'scripting', 'search', 'sessions', 'sidePanel', 'storage',
  'system.cpu', 'system.display', 'system.memory', 'system.storage',
  'tabCapture', 'tabGroups', 'tabs', 'topSites', 'tts', 'ttsEngine',
  'unlimitedStorage', 'vpnProvider', 'wallpaper', 'webAuthenticationProxy',
  'webNavigation', 'webRequest', 'webRequestBlocking',
]);

for (const perm of (manifest.permissions ?? [])) {
  if (!CHROME_PERMISSIONS.has(perm))
    warn(`Unknown Chrome permission: "${perm}" — typo or non-Chrome permission?`);
}

// ─── 5. Service worker JS syntax check ───────────────────────────────────────
const sw = manifest.background?.service_worker;
if (sw && exists(sw)) {
  try {
    // Node's vm module can parse JS syntax without executing it
    const vm   = require('vm');
    const code = fs.readFileSync(resolve(sw), 'utf8');
    new vm.Script(code, { filename: sw });
  } catch (e) {
    error(`Syntax error in service worker "${sw}": ${e.message}`);
  }
}

// ─── 6. Report ───────────────────────────────────────────────────────────────
const name    = `${manifest.name ?? 'Extension'} v${manifest.version ?? '?'}`;
const errIcon = errors.length   ? '✗' : '✓';
const wrnIcon = warnings.length ? '⚠' : '✓';

console.log(`\nValidating ${name}\n`);

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach(w => console.log(w));
  console.log('');
}

if (errors.length) {
  console.log('Errors:');
  errors.forEach(e => console.log(e));
  console.log(`\n${errIcon} Validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}).\n`);
  process.exit(1);
}

console.log(`${errIcon} No errors.`);
if (warnings.length) console.log(`${wrnIcon} ${warnings.length} warning(s) — see above.`);
console.log('');
