import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
}
const buildId = readFileSync('.next/BUILD_ID', 'utf8').trim();
const assets = ['/', ...files('.next/static').filter(file => !file.endsWith('.map')).map(file => file.replace('.next', '/_next'))];
const worker = readFileSync('scripts/service-worker.js', 'utf8').replace('__BUILD_ID__', buildId).replace('__ASSETS__', JSON.stringify(assets));
mkdirSync('public', { recursive: true });
writeFileSync('public/sw.js', worker);
console.log(`Offline cache: ${assets.length} assets, build ${buildId}`);
