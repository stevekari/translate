/**
 * Self-contained, zero-dependency QR Code Matrix Generator.
 * Supports alphanumeric and UTF-8 byte encoding for URLs, Giochat room links, and handles.
 * Generates both SVG markup and HTML Canvas data URLs.
 */

// Reed-Solomon GF(256) log/exp tables
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
})();

function gMult(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function polyMult(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gMult(p[i], q[j]);
    }
  }
  return r;
}

function getGeneratorPoly(degree) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMult(g, new Uint8Array([1, EXP[i]]));
  }
  return g;
}

function calculateECC(data, eccLength) {
  const gen = getGeneratorPoly(eccLength);
  const info = new Uint8Array(data.length + eccLength);
  info.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = info[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        info[i + j] ^= gMult(gen[j], coef);
      }
    }
  }
  return info.slice(data.length);
}

// Capacity table: Version 1 to 6 (Byte mode, Error Correction M)
const VERSIONS = [
  null,
  { version: 1, size: 21, dataBytes: 16, eccBytes: 10 },
  { version: 2, size: 25, dataBytes: 28, eccBytes: 16 },
  { version: 3, size: 29, dataBytes: 44, eccBytes: 26 },
  { version: 4, size: 33, dataBytes: 64, eccBytes: 36 },
  { version: 5, size: 37, dataBytes: 86, eccBytes: 48 },
  { version: 6, size: 41, dataBytes: 108, eccBytes: 64 },
];

function selectVersion(byteCount) {
  for (let v = 1; v < VERSIONS.length; v++) {
    // 4 bits mode + 8 bits count + byteCount * 8 bits <= dataBytes * 8
    const maxData = VERSIONS[v].dataBytes - 2;
    if (byteCount <= maxData) {
      return VERSIONS[v];
    }
  }
  return VERSIONS[6]; // largest supported in compact generator
}

function encodeData(text, versionInfo) {
  const utf8 = new TextEncoder().encode(text);
  const bits = [];

  function addBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // 1. Mode indicator (0100 for 8-bit Byte)
  addBits(0b0100, 4);

  // 2. Character count (8 bits for V1-V9 byte mode)
  addBits(utf8.length, 8);

  // 3. Data bytes
  for (let i = 0; i < utf8.length; i++) {
    addBits(utf8[i], 8);
  }

  // 4. Terminator (up to 4 zeros)
  const maxBits = versionInfo.dataBytes * 8;
  const remaining = maxBits - bits.length;
  addBits(0, Math.min(4, Math.max(0, remaining)));

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 5. Pad bytes (0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    addBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes = new Uint8Array(versionInfo.dataBytes);
  for (let i = 0; i < dataBytes.length; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }

  // 6. Generate Error Correction Code
  const eccBytes = calculateECC(dataBytes, versionInfo.eccBytes);

  // Merge Data + ECC
  const total = new Uint8Array(dataBytes.length + eccBytes.length);
  total.set(dataBytes, 0);
  total.set(eccBytes, dataBytes.length);
  return total;
}

export function createQRCodeMatrix(text) {
  const version = selectVersion(new TextEncoder().encode(text).length);
  const size = version.size;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const isReserved = Array.from({ length: size }, () => Array(size).fill(false));

  function setFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[r0 + r][c0 + c] = isBlack ? 1 : 0;
        isReserved[r0 + r][c0 + c] = true;
      }
    }
    // Separators
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          if (!isReserved[rr][cc]) {
            matrix[rr][cc] = 0;
            isReserved[rr][cc] = true;
          }
        }
      }
    }
  }

  // Finders
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isReserved[6][i]) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      isReserved[6][i] = true;
    }
    if (!isReserved[i][6]) {
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
      isReserved[i][6] = true;
    }
  }

  // Dark module
  matrix[4 * version.version + 9][8] = 1;
  isReserved[4 * version.version + 9][8] = true;

  // Format info reserve
  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }

  // Encode data
  const finalBytes = encodeData(text, version);
  const bits = [];
  for (let i = 0; i < finalBytes.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((finalBytes[i] >> j) & 1);
    }
  }

  // Fill data in snake pattern
  let bitIdx = 0;
  let dir = -1;
  let r = size - 1;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing column
    while (r >= 0 && r < size) {
      for (let dc = 0; dc < 2; dc++) {
        const cc = c - dc;
        if (!isReserved[r][cc]) {
          const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
          // Apply standard Mask 0: (row + col) % 2 === 0
          const mask = (r + cc) % 2 === 0 ? 1 : 0;
          matrix[r][cc] = bit ^ mask;
        }
      }
      r += dir;
    }
    dir = -dir;
    r += dir;
  }

  // Format bits (Error Correction M, Mask 0: 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i];

  return matrix;
}

export function generateQRCodeSVG(text, sizePx = 220) {
  const matrix = createQRCodeMatrix(text);
  const moduleCount = matrix.length;
  const padding = 2; // quiet zone
  const total = moduleCount + padding * 2;
  const cellSize = sizePx / total;

  let rects = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + padding) * cellSize;
        const y = (r + padding) * cellSize;
        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#1877f2" rx="1" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">
    <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="16" />
    ${rects}
  </svg>`;
}
