// Oyunun kaynak kodundan değişmeyen verileri (item tarifleri, item parçaları,
// Pokémon portre numaraları, evrim aileleri, tipler, dükkan kuralları) çıkarıp extension/data/static.json dosyasına yazar.
//
// Kullanım:
//   node scripts/build-static-data.mjs                  (dosyaları GitHub'dan çeker)
//   node scripts/build-static-data.mjs --repo ../pac    (yerel klon)

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const RAW = "https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/"
const OUT = join(ROOT, "extension", "data", "static.json")

async function source(path) {
  const i = process.argv.indexOf("--repo")
  if (i !== -1) return readFile(join(process.argv[i + 1], path), "utf8")
  const res = await fetch(RAW + path)
  if (!res.ok) throw new Error(`${path} indirilemedi: HTTP ${res.status}`)
  return res.text()
}

function block(src, header) {
  const start = src.indexOf(header)
  if (start === -1) throw new Error(`"${header}" bulunamadı, oyun kodu değişmiş olabilir`)
  const end = src.indexOf("\n}", start)
  return src.slice(start, end)
}

function itemList(src, header) {
  const start = src.indexOf("= [", src.indexOf(header)) + 3
  const body = src.slice(start)
  return [...body.slice(0, body.indexOf("]")).matchAll(/Item\.(\w+)/g)].map((m) => m[1])
}

const itemSrc = await source("app/types/enum/Item.ts")
const pokemonSrc = await source("app/types/enum/Pokemon.ts")

const recipes = {}
for (const m of block(itemSrc, "export const ItemRecipe").matchAll(/\[Item\.(\w+)\]:\s*\[Item\.(\w+),\s*Item\.(\w+)\]/g)) {
  recipes[m[1]] = [m[2], m[3]]
}

const components = [
  ...itemList(itemSrc, "export const ItemComponentsNoFossilOrScarf"),
  "FOSSIL_STONE",
  "SILK_SCARF"
]

const pkmIndex = {}
for (const m of block(pokemonSrc, "export const PkmIndex").matchAll(/^\s*\[Pkm\.(\w+)\]:\s*"([\d-]+)"/gm)) {
  pkmIndex[m[1]] = m[2]
}

// Pokémon -> evrim ailesinin ilk üyesi (Charmeleon -> Charmander). Dizilim eşleştirirken
// tahtadaki Charmander'ın meta takımlardaki Charizard ile aynı birim sayılması için.
const family = {}
for (const m of block(pokemonSrc, "export const PkmFamily").matchAll(/^\s*\[Pkm\.(\w+)\]:\s*Pkm\.(\w+)/gm)) {
  if (m[1] !== m[2]) family[m[1]] = m[2]
}

// Pokémon tip / nadirlik / yıldız bilgisi (oyunun ürettiği CSV'den)
// name -> [nadirlik, yıldız, tipler, ek seçim mi, bölgesel mi, aşama sayısı, dükkanda çıkar mı]
const csv = (await source("app/models/precomputed/pokemons-data.csv")).trim().split(/\r?\n/)
const head = csv.shift().split(",")
const col = (name) => head.indexOf(name)
const pokemons = {}
// Yerleşim önerisi için savaş istatistikleri: name -> [menzil, can, saldırı, savunma, özel savunma]
const stats = {}
for (const line of csv) {
  const c = line.split(",")
  const types = ["Type 1", "Type 2", "Type 3", "Type 4"].map((t) => c[col(t)]).filter(Boolean)
  pokemons[c[col("Name")]] = [
    c[col("Category")],
    Number(c[col("Tier")]),
    types,
    c[col("Additional pick")] === "true",
    c[col("Regional")] === "true",
    Number(c[col("Nb stages")]),
    c[col("Ability")] !== "DEFAULT"
  ]
  stats[c[col("Name")]] = ["Attack Range", "HP", "Attack", "Defense", "Special Defense"].map((name) => Number(c[col(name)]))
}

// Duo Pokémonlar (ek seçimlerde "LATIOS_LATIAS" gibi gelir)
const duos = {}
for (const m of block(pokemonSrc, "export const PkmDuos").matchAll(/\[PkmDuo\.(\w+)\]:\s*\[([^\]]+)\]/g)) {
  duos[m[1]] = [...m[2].matchAll(/Pkm\.(\w+)/g)].map((x) => x[1])
}

// Dükkan kuralları: seviye başına nadirlik olasılıkları, havuz boyutları, dükkan genişliği
const shopSrc = await source("app/config/game/shop.ts")
const rarityProbability = {}
for (const m of block(shopSrc, "export const RarityProbabilityPerLevel").matchAll(/^\s*(\d+):\s*\[([^\]]+)\]/gm)) {
  rarityProbability[m[1]] = m[2].split(",").map(Number)
}
const shopSize = Number(shopSrc.match(/SHOP_SIZE\s*=\s*(\d+)/)[1])
const poolSize = {}
for (const m of block(await source("app/config/game/pools.ts"), "export const PoolSize").matchAll(/\[Rarity\.(\w+)\]:\s*\[([^\]]+)\]/g)) {
  poolSize[m[1]] = m[2].split(",").map(Number)
}

const rules = { rarityProbability, poolSize, shopSize, shopRarities: ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA"] }

// Bölge adları canlı portal ve /meta/regions kayıtlarındaki DungeonPMDO değerleridir.
// town bir oynanabilir bölge olmadığı için yalnız enum anahtarlı kayıtları al.
const regionSrc = await source("app/config/maps/regions.ts")
const dungeonSrc = await source("app/types/enum/Dungeon.ts")
const dungeonNames = Object.fromEntries([...block(dungeonSrc, "export enum DungeonPMDO")
  .matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]))
const regions = {}
for (const m of regionSrc.matchAll(/\[DungeonPMDO\.(\w+)\]:\s*\{\s*synergies:\s*\[([^\]]+)\]/g)) {
  const name = dungeonNames[m[1]]
  if (!name) throw new Error(`Bölge enum değeri bulunamadı: ${m[1]}`)
  regions[name] = [...m[2].matchAll(/Synergy\.(\w+)/g)].map((s) => s[1])
  if (!regions[name].length) throw new Error(`Bölge sinerjileri bulunamadı: ${name}`)
}

if (
  Object.keys(regions).length < 50 ||
  Object.keys(pokemons).length < 500 ||
  Object.values(stats).filter((v) => v.every(Number.isFinite) && v[0] >= 1).length < 500 ||
  Object.keys(duos).length < 3 ||
  Object.keys(rarityProbability).length < 9 ||
  !poolSize.COMMON ||
  Object.keys(recipes).length < 30 ||
  components.length < 10 ||
  Object.keys(pkmIndex).length < 500 ||
  Object.keys(family).length < 300
) {
  throw new Error("Beklenenden az veri çıktı, ayrıştırıcıyı kontrol et")
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({ components, recipes, pkmIndex, family, pokemons, stats, duos, rules, regions }))
console.log(`✔ ${OUT}`)
console.log(`  ${components.length} parça, ${Object.keys(recipes).length} tarif, ${Object.keys(pkmIndex).length} Pokémon, ${Object.keys(family).length} evrim, ${Object.keys(pokemons).length} tip kaydı, ${Object.keys(duos).length} duo, ${Object.keys(regions).length} bölge`)
