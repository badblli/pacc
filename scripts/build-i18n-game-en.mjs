// İngilizce arayüz için oyunun kendi İngilizce metinlerinden küçük bir dosya üretir:
// Pokémon / item / sinerji / elo / harita adları ve panelin gösterdiği item açıklamaları + etiketler.
// Türkçe arayüz zaten extension/locales/tr/translation.json dosyasını kullanır.
//
// Kullanım:
//   node scripts/build-i18n-game-en.mjs                         (translations/en-live.snapshot.json'dan)
//   node scripts/build-i18n-game-en.mjs path/to/en/translation.json
//
// Çıktı: extension/i18n/game.en.json

import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "translations", "en-live.snapshot.json")
const OUT = join(ROOT, "extension", "i18n", "game.en.json")

// panel.js / overlay.js'in okuduğu bölümler (state.text.<bölüm>)
const SECTIONS = ["pkm", "item", "synergy", "elorank", "map", "item_description", "stat", "status", "damage", "technical_terms"]

const en = JSON.parse(await readFile(SOURCE, "utf8"))
const out = {}
for (const section of SECTIONS) {
  const value = en[section]
  if (!value || typeof value !== "object") throw new Error(`"${section}" bölümü bulunamadı: ${SOURCE}`)
  out[section] = Object.fromEntries(Object.entries(value).filter(([, text]) => typeof text === "string"))
}
const json = JSON.stringify(out) + "\n"
await writeFile(OUT, json)
console.log(`${OUT}: ${SECTIONS.map((s) => `${s} ${Object.keys(out[s]).length}`).join(", ")} (${(json.length / 1024).toFixed(0)} KB)`)
