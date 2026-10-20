// İngilizce translation.json'u alır (master ve canlı sitenin birleşimi),
// translations/tr.partial.json içindeki Türkçe çevirileri üstüne yazar ve
// eklentinin servis edeceği tam dosyayı üretir.
// Çevrilmemiş anahtarlar İngilizce kalır, böylece oyun hiçbir metni kaybetmez.
//
// Kullanım:
//   node scripts/build-translation.mjs                               (URL'lerden çeker)
//   node scripts/build-translation.mjs --en yol.json                 (yerel master en dosyası)
//   node scripts/build-translation.mjs --en-live yol.json            (yerel canlı en dosyası)
//   node scripts/build-translation.mjs --en m.json --en-live c.json

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const EN_URL =
  "https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/app/public/dist/client/locales/en/translation.json"
const EN_LIVE_URL =
  "https://pokemon-auto-chess.com/locales/en/translation.json"
const PARTIAL = join(ROOT, "translations", "tr.partial.json")
const OUT = join(ROOT, "extension", "locales", "tr", "translation.json")

// Oyun bu kalıpları ikon / sayı ile değiştirir; çeviride aynen kalmaları gerekir.
const TOKEN_RE = /\{\{[^}]+\}\}|\[[^\]]+\]|(?<![\p{L}\d_])[A-Z][A-Z0-9_]+(?![\p{L}\d_])/gu

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v)

async function loadMasterEnglish() {
  const i = process.argv.indexOf("--en")
  if (i !== -1) return JSON.parse(await readFile(process.argv[i + 1], "utf8"))
  const res = await fetch(EN_URL)
  if (!res.ok) throw new Error(`master en çevirisi indirilemedi: HTTP ${res.status}`)
  return res.json()
}

async function loadLiveEnglish() {
  const i = process.argv.indexOf("--en-live")
  if (i !== -1) return JSON.parse(await readFile(process.argv[i + 1], "utf8"))
  try {
    const res = await fetch(EN_LIVE_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`⚠ Canlı en çevirisi indirilemedi (${err.message}); yalnız master ile devam ediliyor.`)
    return null
  }
}

// Master ve canlı sitenin dosyasının birleşimi:
// Anahtar birinde varsa çıktıda olur; değer önceliği canlı site.
function combineEnglish(master, live) {
  if (!live) return master
  if (!master) return live
  if (!isObj(master) || !isObj(live)) {
    return live !== undefined ? live : master
  }
  const combined = {}
  const allKeys = new Set([...Object.keys(master), ...Object.keys(live)])
  for (const key of allKeys) {
    if (key in live && key in master) {
      if (isObj(master[key]) && isObj(live[key])) {
        combined[key] = combineEnglish(master[key], live[key])
      } else {
        combined[key] = live[key]
      }
    } else if (key in live) {
      combined[key] = live[key]
    } else {
      combined[key] = master[key]
    }
  }
  return combined
}

function countLiveOnlyKeys(master, live) {
  if (!live) return 0
  let count = 0
  function countLeafKeys(obj) {
    for (const v of Object.values(obj)) {
      if (isObj(v)) countLeafKeys(v)
      else count++
    }
  }
  function walk(m, l) {
    if (!l || typeof l !== "object") return
    for (const [k, v] of Object.entries(l)) {
      const mVal = m ? m[k] : undefined
      if (isObj(v)) {
        if (isObj(mVal)) {
          walk(mVal, v)
        } else {
          countLeafKeys(v)
        }
      } else {
        if (mVal === undefined || isObj(mVal)) {
          count++
        }
      }
    }
  }
  walk(master, live)
  return count
}

// [50,LK] gibi kalıplarda sayı olmayan ilk kısım (ör. [sometimes,LK]) çevrilebilir,
// o yüzden köşeli parantezleri sadece son ekine (LK/SP/ND) göre karşılaştırıyoruz.
const bracketSignature = (tok) => {
  const parts = tok.slice(1, -1).split(",")
  return parts.every((x) => /^[\d.]+$/.test(x) || /^(LK|SP|ND)/.test(x)) ? tok : `[…,${parts.at(-1)}]`
}

function tokens(str) {
  // Tamamı büyük harf olan metinler ("WOOF !") kalıp değil, düz yazıdır.
  if (!/\p{Ll}/u.test(str)) return []
  return [...str.matchAll(TOKEN_RE)].map((m) => (m[0].startsWith("[") ? bracketSignature(m[0]) : m[0]))
}

const stats = { total: 0, translated: 0, warnings: [], unknown: [] }

function merge(en, tr, path) {
  if (!isObj(en)) {
    stats.total++
    if (typeof tr !== "string") return en
    if (typeof en === "string") {
      const have = tokens(tr)
      const missing = tokens(en).filter((t) => !have.includes(t))
      if (missing.length) {
        // Çeviri, oyunun bu sürümündeki İngilizceyle uyuşmuyor (çoğunlukla Türkçe yeni master'a göre
        // yazılmış, canlı site henüz eski metni kullanıyor). Bozuk ikon göstermek yerine İngilizceye düş.
        stats.warnings.push(`${path}: eksik kalıp(lar) ${[...new Set(missing)].join(", ")}`)
        return en
      }
    }
    stats.translated++
    return tr
  }
  const out = {}
  for (const key of Object.keys(en)) {
    out[key] = merge(en[key], isObj(tr) ? tr[key] : undefined, path ? `${path}.${key}` : key)
  }
  if (isObj(tr)) {
    for (const key of Object.keys(tr)) {
      if (!(key in en)) stats.unknown.push(path ? `${path}.${key}` : key)
    }
  }
  return out
}

const masterEn = await loadMasterEnglish()
const liveEn = await loadLiveEnglish()
const liveOnlyCount = countLiveOnlyKeys(masterEn, liveEn)
const en = combineEnglish(masterEn, liveEn)

const partial = JSON.parse(await readFile(PARTIAL, "utf8"))
delete partial.$comment
const merged = merge(en, partial, "")

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(merged))

const pct = ((stats.translated / stats.total) * 100).toFixed(1)
console.log(`✔ ${OUT}`)
console.log(`  Çevrilen: ${stats.translated} / ${stats.total} metin (%${pct})`)
if (liveEn) {
  console.log(`  Canlı sitede olup master'da olmayan anahtar sayısı: ${liveOnlyCount}`)
}
if (stats.unknown.length) {
  console.log(`  ⚠ İngilizce dosyada olmayan ${stats.unknown.length} anahtar (silinmiş olabilir):`)
  for (const k of stats.unknown.slice(0, 20)) console.log(`    - ${k}`)
}
if (stats.warnings.length) {
  console.log(`  ⚠ ${stats.warnings.length} metinde oyunun kullandığı kalıplar eksik; bunlar İngilizce gösterilecek:`)
  for (const w of stats.warnings.slice(0, 30)) console.log(`    - ${w}`)
}
