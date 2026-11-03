const { toQR } = require('toqr');
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'exp://200.128.156.227:8081';
const data = toQR(url);
const extent = Math.sqrt(data.byteLength) | 0;

let rects = [];
for (let y = 0; y < extent; y++) {
  for (let x = 0; x < extent; x++) {
    if (data[y * extent + x]) {
      rects.push(`<rect x="${x + 4}" y="${y + 4}" width="1" height="1" fill="#111827"/>`);
    }
  }
}

const size = extent + 8;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="320" height="320" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#ffffff" rx="12"/>
  ${rects.join('\n  ')}
</svg>`;

const outPath = path.join(__dirname, '..', 'qrcode.svg');
fs.writeFileSync(outPath, svg, 'utf8');
console.log('QRCode SVG generated at:', outPath);

