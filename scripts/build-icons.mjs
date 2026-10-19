// Eklenti logosunu üretir: tek bir 16x16 piksel ızgarasından
//   extension/icons/logo.svg  ve  icon-16/32/48/128.png
// Bağımlılık yok (PNG kodlayıcı node:zlib ile). Her PNG ızgaranın tam sayı katıdır
// (16 -> x1, 32 -> x2, 48 -> x3, 128 -> x8), bu yüzden kenarlar bulanıklaşmaz.
//
// Kullanım: node scripts/build-icons.mjs

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync } from "node:zlib"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "extension", "icons")

// Renkler (oyunun koyu lacivert + sarı/turuncu paleti; "n" damalı tahta, "b" çerçeve)
const PALETTE = {
  N: "#232b4d", // tahta zemini
  n: "#3a4780", // damalı tahta (açık kare)
  b: "#56619a", // çerçeve
  K: "#0c1020", // top çizgisi
  R: "#ee5a3c", // topun üst yarısı
  W: "#f2f4fa", // topun alt yarısı ve düğme
  Y: "#ffd966", // boynuz (açık sarı)
  y: "#f0a92e", // boynuz (gölge turuncu)
}

// Sol yarı (8 sütun x 16 satır); sağ yarı aynalanır. "." saydam.
const LEFT = [
  "..NNNNNN",
  ".NNNNNNN",
  "NNNYYNNN",
  "NNYyNNNN",
  "NYyNNNKK",
  "NYyNNKRR",
  "NYyNKRRK",
  "NYYYKKKW",
  "NNyyKKKW",
  "NNNNKWWK",
  "NNNNNKWW",
  "NNNNNNKK",
  "NNNNNNNN",
  "NNNNNNNN",
  ".nnNNnnN",
  "..NNnnNN",
]

const N = 16
const GRID = LEFT.map((half) => {
  const right = [...half].reverse().join("")
  // damalı satırlarda sağ yarı aynalanınca kareler yer değiştirir: bilerek kayık bırakıldı
  return half + right
})

// Dış halkadaki lacivert hücreleri çerçeve rengine çevir
for (let y = 0; y < N; y++) {
  const row = [...GRID[y]]
  for (let x = 0; x < N; x++) {
    if (row[x] === "N" || row[x] === "n") {
      const edge = x === 0 || x === N - 1 || y === 0 || y === N - 1 || row[x - 1] === "." || row[x + 1] === "." || GRID[y - 1]?.[x] === "." || GRID[y + 1]?.[x] === "."
      if (edge) row[x] = "b"
    }
  }
  GRID[y] = row.join("")
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

// ---- SVG -------------------------------------------------------------
function buildSvg() {
  const rects = []
  for (let y = 0; y < N; y++) {
    let x = 0
    while (x < N) {
      const c = GRID[y][x]
      if (c === ".") { x++; continue }
      let w = 1
      while (x + w < N && GRID[y][x + w] === c) w++
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PALETTE[c]}"/>`)
      x += w
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="128" height="128" shape-rendering="crispEdges">\n  ${rects.join("\n  ")}\n</svg>\n`
}

// ---- PNG -------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, "ascii")
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, tail])
}

function encodePng(size) {
  const scale = size / N
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filtre: yok
    for (let x = 0; x < size; x++) {
      const c = GRID[Math.floor(y / scale)][Math.floor(x / scale)]
      const o = rowStart + 1 + x * 4
      if (c === ".") continue // saydam (0,0,0,0)
      const [r, g, b] = hexToRgb(PALETTE[c])
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit derinliği
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

await mkdir(OUT, { recursive: true })
await writeFile(join(OUT, "logo.svg"), buildSvg())
for (const size of [16, 32, 48, 128]) {
  await writeFile(join(OUT, `icon-${size}.png`), encodePng(size))
}
console.log("icons yazıldı:", OUT)
