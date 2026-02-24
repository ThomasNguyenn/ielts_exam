import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  initialRawMax: 300 * KB,
  initialGzipMax: 90 * KB,
  vendorRechartsRawMax: 450 * KB,
  vendorPdfRawMax: 650 * KB,
  otherChunkRawMax: 260 * KB,
};

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');

const existsOrExit = (targetPath, label) => {
  if (fs.existsSync(targetPath)) return;
  console.error(`[bundle-budget] Missing ${label}: ${targetPath}`);
  process.exit(1);
};

const toGzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;

const parseInitialJsAssets = (html) => {
  const moduleScriptRegex = /<script[^>]+type="module"[^>]+src="([^"]+)"/g;
  const modulePreloadRegex = /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g;

  const refs = [
    ...[...html.matchAll(moduleScriptRegex)].map((match) => match[1]),
    ...[...html.matchAll(modulePreloadRegex)].map((match) => match[1]),
  ];

  const normalized = refs
    .map((ref) => String(ref || '').split('?')[0].split('#')[0])
    .map((ref) => (ref.startsWith('/') ? ref.slice(1) : ref))
    .filter((ref) => ref.startsWith('assets/') && ref.endsWith('.js'));

  return [...new Set(normalized)];
};

existsOrExit(distDir, 'dist directory');
existsOrExit(assetsDir, 'dist/assets directory');
existsOrExit(indexHtmlPath, 'dist/index.html');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
const initialAssetRefs = parseInitialJsAssets(indexHtml);

if (initialAssetRefs.length === 0) {
  console.error('[bundle-budget] Could not detect initial JS assets from dist/index.html');
  process.exit(1);
}

let initialRawTotal = 0;
let initialGzipTotal = 0;
for (const ref of initialAssetRefs) {
  const filePath = path.join(distDir, ref);
  existsOrExit(filePath, `initial asset ${ref}`);
  const content = fs.readFileSync(filePath);
  initialRawTotal += content.length;
  initialGzipTotal += toGzipSize(content);
}

const allJsFiles = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, filePath: path.join(assetsDir, file), size: fs.statSync(path.join(assetsDir, file)).size }));

const failures = [];

if (initialRawTotal > BUDGETS.initialRawMax) {
  failures.push(
    `Initial JS raw size ${initialRawTotal} bytes exceeds budget ${BUDGETS.initialRawMax} bytes`,
  );
}

if (initialGzipTotal > BUDGETS.initialGzipMax) {
  failures.push(
    `Initial JS gzip size ${initialGzipTotal} bytes exceeds budget ${BUDGETS.initialGzipMax} bytes`,
  );
}

for (const { file, size } of allJsFiles) {
  if (file.startsWith('vendor-recharts-')) {
    if (size > BUDGETS.vendorRechartsRawMax) {
      failures.push(`Chunk ${file} is ${size} bytes and exceeds recharts budget ${BUDGETS.vendorRechartsRawMax} bytes`);
    }
    continue;
  }

  if (file.startsWith('vendor-pdf-')) {
    if (size > BUDGETS.vendorPdfRawMax) {
      failures.push(`Chunk ${file} is ${size} bytes and exceeds pdf budget ${BUDGETS.vendorPdfRawMax} bytes`);
    }
    continue;
  }

  if (size > BUDGETS.otherChunkRawMax) {
    failures.push(`Chunk ${file} is ${size} bytes and exceeds generic chunk budget ${BUDGETS.otherChunkRawMax} bytes`);
  }
}

const topLargest = [...allJsFiles]
  .sort((a, b) => b.size - a.size)
  .slice(0, 8)
  .map(({ file, size }) => `${file}: ${size} bytes`);

console.log('[bundle-budget] Initial assets:', initialAssetRefs.join(', '));
console.log('[bundle-budget] Initial raw bytes:', initialRawTotal);
console.log('[bundle-budget] Initial gzip bytes:', initialGzipTotal);
console.log('[bundle-budget] Largest JS chunks:');
for (const line of topLargest) {
  console.log(`  - ${line}`);
}

if (failures.length > 0) {
  console.error('[bundle-budget] Budget check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('[bundle-budget] All bundle budgets passed.');
