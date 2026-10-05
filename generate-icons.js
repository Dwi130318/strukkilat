import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createPng(width, height, isMaskable = false) {
  // Create RGBA raw buffer
  const stride = width * 4 + 1; // 1 filter byte per row
  const rawData = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Normalized coordinates [0, 1]
      const nx = x / width;
      const ny = y / height;
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);

      // Background: Deep dark slate gradient (#0f172a to #020617)
      let r = Math.round(15 - ny * 13);
      let g = Math.round(23 - ny * 17);
      let b = Math.round(42 - ny * 19);
      let a = 255;

      // Outer boundary: rounded squircle (unless maskable, which is full bleed)
      if (!isMaskable) {
        // Corner radius ~ 22%
        const cornerR = 0.22;
        const dx = Math.max(0, Math.abs(cx) - (0.5 - cornerR));
        const dy = Math.max(0, Math.abs(cy) - (0.5 - cornerR));
        if (Math.sqrt(dx * dx + dy * dy) > cornerR) {
          a = 0; // Transparent outside squircle
        }
      }

      if (a > 0) {
        // Subtle Cyan-Indigo Border
        const borderDist = Math.max(Math.abs(cx), Math.abs(cy));
        if (borderDist > 0.46 && borderDist < 0.485) {
          r = 99; g = 102; b = 241; // Indigo
        }

        // Draw Thermal Receipt Paper (Center Top: x in [0.28, 0.72], y in [0.18, 0.46])
        if (nx >= 0.28 && nx <= 0.72 && ny >= 0.18 && ny <= 0.46) {
          r = 248; g = 250; b = 252; // White Paper

          // Paper text lines
          if (
            (ny >= 0.24 && ny <= 0.26 && nx >= 0.34 && nx <= 0.66) ||
            (ny >= 0.28 && ny <= 0.30 && nx >= 0.34 && nx <= 0.58) ||
            (ny >= 0.32 && ny <= 0.34 && nx >= 0.34 && nx <= 0.62)
          ) {
            r = 71; g = 85; b = 105; // Slate lines
          }

          // Amber bolt symbol (center right on receipt)
          if (nx >= 0.52 && nx <= 0.64 && ny >= 0.36 && ny <= 0.44) {
            r = 245; g = 158; b = 11; // Amber
          }
        }

        // Draw Printer Body (x in [0.22, 0.78], y in [0.44, 0.80])
        if (nx >= 0.22 && nx <= 0.78 && ny >= 0.44 && ny <= 0.80) {
          // Dark metallic printer casing (#1e293b)
          r = 30; g = 41; b = 59;

          // Slot gap where paper exits
          if (ny >= 0.44 && ny <= 0.47 && nx >= 0.26 && nx <= 0.74) {
            r = 2; g = 6; b = 23;
          }

          // Green LED indicator (bottom left)
          const ledDist = Math.hypot(nx - 0.32, ny - 0.65);
          if (ledDist < 0.03) {
            r = 16; g = 185; b = 129; // Emerald LED
          }

          // Bluetooth icon / Cyan LED (center)
          const btDist = Math.hypot(nx - 0.50, ny - 0.65);
          if (btDist < 0.025) {
            r = 56; g = 189; b = 248; // Cyan
          }

          // Feed Button (bottom right)
          if (nx >= 0.64 && nx <= 0.72 && ny >= 0.62 && ny <= 0.68) {
            r = 71; g = 85; b = 105;
          }
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Compress data with zlib
  const compressed = zlib.deflateSync(rawData);

  // Build PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    Buffer.alloc(4),
  ]);
  ihdrChunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData])), 17);

  // IDAT Chunk
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(Buffer.concat([Buffer.from('IDAT'), compressed])), 0);
  const idatChunk = Buffer.concat([idatLen, Buffer.from('IDAT'), compressed, idatCrc]);

  // IEND Chunk
  const iendChunk = Buffer.from([
    0, 0, 0, 0,
    73, 69, 78, 68,
    174, 66, 96, 130,
  ]);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

// Generate PNG icons
fs.writeFileSync('./public/pwa-192x192.png', createPng(192, 192, false));
fs.writeFileSync('./public/pwa-512x512.png', createPng(512, 512, false));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPng(512, 512, true));
fs.writeFileSync('./public/apple-touch-icon.png', createPng(180, 180, false));
fs.writeFileSync('./public/favicon.ico', createPng(64, 64, false));

console.log('PWA PNG icons generated successfully!');
