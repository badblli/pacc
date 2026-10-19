// Arayüz dili (en / tr) testleri: katalog anahtar eşitliği, koddaki anahtarların varlığı, PacI18n davranışı,
// advisor gerekçelerinin iki dilde eksiksiz üretilmesi ve kodda sabit Türkçe metin kalmaması.
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import vm from "node:vm"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const json = (path) => JSON.parse(read(path))
const en = json("extension/i18n/en.json")
const tr = json("extension/i18n/tr.json")
const vars = (text) => [...String(text).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/

// ---------- 1) Katalog yapısı ----------
assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort(), "en.json ve tr.json aynı anahtar setine sahip olmalı")
for (const [key, text] of Object.entries(en)) {
  assert.equal(typeof text, "string", `en ${key}`)
  assert.equal(typeof tr[key], "string", `tr ${key}`)
  assert.ok(text.trim() || key.endsWith("_one"), `en ${key} boş`)
  assert.deepEqual(vars(tr[key]), vars(text), `${key}: {{değişken}} seti iki dilde aynı olmalı`)
  assert.ok(!/<[a-z]/i.test(text) && !/<[a-z]/i.test(tr[key]), `${key}: katalogda HTML olmamalı`)
  assert.ok(!TURKISH.test(text) || key === "popup.translation" || key === "app.name", `en ${key} Türkçe karakter içeriyor: ${text}`)
}
// Çoğul: _one varsa _other da olmalı
for (const key of Object.keys(en)) if (key.endsWith("_one")) assert.ok(`${key.slice(0, -4)}_other` in en, key)

const enMsg = json("extension/_locales/en/messages.json")
const trMsg = json("extension/_locales/tr/messages.json")
assert.deepEqual(Object.keys(enMsg).sort(), Object.keys(trMsg).sort(), "_locales en/tr aynı anahtarlar")
const manifest = json("extension/manifest.json")
assert.equal(manifest.default_locale, "en")
for (const [, name] of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) {
  assert.ok(enMsg[name]?.message && trMsg[name]?.message, `manifest __MSG_${name}__ iki dilde tanımlı olmalı`)
}
for (const msg of [enMsg, trMsg]) {
  assert.ok(msg.extName.message.length <= 75, "name ≤ 75 karakter")
  assert.ok(msg.extDescription.message.length <= 132, "description ≤ 132 karakter")
}
const scripts = manifest.content_scripts.find((c) => c.js.includes("content/panel.js")).js
assert.equal(scripts[0], "content/i18n.js", "i18n.js advisor/overlay/panel'den önce yüklenmeli")
const war = manifest.web_accessible_resources.flatMap((w) => w.resources)
for (const file of ["i18n/en.json", "i18n/tr.json", "i18n/game.en.json"]) assert.ok(war.includes(file), file)

// ---------- 2) Kodda kullanılan anahtarlar kataloglarda var; katalogda kullanılmayan anahtar yok ----------
const codeFiles = [
  ...readdirSync(new URL("../extension/content/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `extension/content/${f}`),
  "extension/popup/popup.js",
  "extension/popup/popup.html"
]
// Yorumlar hariç (HTML yorumları ve satır sonu // yorumları)
const code = codeFiles
  .map(read)
  .join("\n")
  .replace(/<!--[\s\S]*?-->/g, "")
  .split("\n")
  .map((line) => line.replace(/(^|\s)\/\/.*$/, ""))
  .join("\n")
const KEY = /["'`]((?:app|advice|num|rarity|panel|overlay|popup)\.[A-Za-z0-9_.-]+)["'`]/g
const used = new Set([...code.matchAll(KEY)].map((m) => m[1]).filter((key) => !/\.(css|js|json|png|html)$/.test(key)))
for (const [, key] of code.matchAll(/data-i18n="([^"]+)"/g)) used.add(key)
// Şablonla kurulan anahtarlar (ör. `panel.craft.${r.state}`)
const dynamic = {
  "advice.verdict.": ["best", "good", "avoid"],
  "overlay.": ["best", "good", "avoid"],
  "panel.tab.": ["game", "pokemon", "comps", "items"],
  "panel.craft.": ["have", "craftable", "one-missing", "far", "none"],
  "rarity.": ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA"]
}
for (const [prefix, list] of Object.entries(dynamic)) {
  assert.ok(code.includes("`" + prefix + "${"), `dinamik anahtar öneki kodda yok: ${prefix}`)
  for (const suffix of list) used.add(prefix + suffix)
}
const base = (key) => key.replace(/_(one|other)$/, "")
const catalogBases = new Set(Object.keys(en).map(base))
for (const key of used) assert.ok(catalogBases.has(key), `kodda kullanılan anahtar katalogda yok: ${key}`)
for (const key of catalogBases) assert.ok(used.has(key), `katalogda kullanılmayan anahtar: ${key}`)

// ---------- 3) PacI18n ----------
globalThis.window = {}
vm.runInThisContext(read("extension/content/i18n.js"), { filename: "i18n.js" })
vm.runInThisContext(read("extension/content/advisor.js"), { filename: "advisor.js" })
const i18n = window.PacI18n
await i18n.ready
assert.equal(i18n.lang, "en", "chrome yokken varsayılan dil İngilizce")
assert.equal(i18n.resolveLang("auto", "tr-TR"), "tr")
assert.equal(i18n.resolveLang("auto", "TR"), "tr")
assert.equal(i18n.resolveLang("auto", "en-US"), "en")
assert.equal(i18n.resolveLang("auto", "de-DE"), "en")
assert.equal(i18n.resolveLang(undefined, "tr"), "tr")
assert.equal(i18n.resolveLang("en", "tr-TR"), "en")
assert.equal(i18n.resolveLang("tr", "en-US"), "tr")
// Katalog yokken anahtar döner (strict değil)
assert.equal(i18n.t("panel.close"), "panel.close")
i18n.register("en", en)
i18n.register("tr", tr)
let changes = 0
const off = i18n.onChange(() => changes++)
await i18n.setLang("tr")
assert.equal(i18n.lang, "tr")
assert.equal(changes, 1)
await i18n.setLang("tr")
assert.equal(changes, 1, "aynı dile geçiş olay üretmez")
await i18n.setLang("xx")
assert.equal(i18n.lang, "en", "bilinmeyen dil İngilizceye düşer")
off()
assert.equal(i18n.t("num.games", { count: 1, n: "1" }), "1 game")
assert.equal(i18n.t("num.games", { count: 5766, n: i18n.number(5766) }), "5,766 games")
assert.equal(i18n.t("advice.inComps", { count: 2, rank: "3.1" }), "In 2 meta comps (best average #3.1)")
assert.equal(i18n.html("panel.search.none", { q: `<img src=x onerror="a">` }), "No results for &quot;&lt;img src=x onerror=&quot;a&quot;&gt;&quot;")
assert.equal(i18n.html("panel.pkm.rank", { place: { html: "<b>3.10</b>" } }), "Rank <b>3.10</b>")
assert.equal(i18n.humanize("SANDY_SHOCKS"), "Sandy Shocks")
await i18n.setLang("tr")
assert.equal(i18n.t("num.games", { count: 5766, n: i18n.number(5766) }), "5.766 oyun")
assert.equal(i18n.t("num.pct", { n: 82 }), "%82")
assert.equal(i18n.locale(), "tr-TR")
// Türkçede eksik anahtar İngilizceye düşer
i18n.register("tr", { ...tr, "panel.close": undefined })
assert.equal(i18n.t("panel.close"), "Close")
i18n.register("tr", tr)
// strict: eksik anahtar ve değişken hata
i18n.strict = true
assert.throws(() => i18n.t("panel.nope"), /missing key/)
assert.throws(() => i18n.t("panel.pkm.family", {}), /missing variable/)

// ---------- 4) Advisor gerekçeleri iki dilde eksiksiz ----------
const data = json("extension/data/static.json")
const gameEn = json("extension/i18n/game.en.json")
const gameTr = json("extension/locales/tr/translation.json")
for (const section of ["pkm", "item", "synergy", "elorank", "map", "item_description", "stat", "status", "damage", "technical_terms"]) {
  assert.ok(Object.keys(gameEn[section] ?? {}).length, `game.en.json: ${section}`)
}
const pkmKeys = Object.keys(data.pokemons)
assert.ok(pkmKeys.filter((k) => gameEn.pkm[k]).length / pkmKeys.length > 0.99, "İngilizce Pokémon adları static.json'ı kapsıyor")
for (const item of [...data.components, ...Object.keys(data.recipes)]) assert.ok(gameEn.item[item], `İngilizce item adı: ${item}`)

const advisor = window.PacAdvisor
const ctxFor = (game) => ({
  t: (key, v) => i18n.t(key, v),
  data,
  minGames: 20,
  thresholds: { FIRE: [2, 4, 6], DRAGON: [3, 6], WATER: [3, 6] },
  tierPokemons: {
    CHARIZARD: [3.1, 100, 2, ["FIRE_STONE", "LEFTOVERS"]],
    BLASTOISE: [3.4, 80, 2, ["WATER_STONE"]],
    VENUSAUR: [5.7, 50, 1, []],
    LATIOS: [3.2, 40, 1, []],
    LATIAS: [4.2, 40, 1, []]
  },
  tierItems: { FIRE_STONE: [3.2, 80, []], WATER_STONE: [3.5, 60, []], BLACK_BELT: [5.8, 80, []] },
  clusters: [
    { id: "fire", count: 80, rank: 3.3, winrate: 30, synergies: { FIRE: 4 },
      pokemons: [{ name: "CHARIZARD", frequency: 0.8 }, { name: "VULPIX", frequency: 0.7 }, { name: "LAPRAS", frequency: 0.5 }], items: [] },
    { id: "water", count: 60, rank: 3.5, winrate: 20, synergies: { WATER: 4 }, pokemons: [{ name: "BLASTOISE", frequency: 0.7 }], items: [] }
  ],
  names: {
    pkm: (k) => game.pkm[k] ?? k,
    item: (k) => game.item[k] ?? k,
    syn: (k) => game.synergy[k] ?? k
  }
})
const unit = (name, y = 1, extra = {}) => ({ name, y, x: 1, stars: 1, items: [], types: [], ...extra })
const choose = (type, pokemons = [], items = []) => ({ id: `t-${type}`, type, pokemons, items, costs: [] })
const base0 = { board: [], shop: [], choices: [], inventory: [], synergies: {}, itemsProposition: [], pokemonsProposition: [], level: 3, money: 20, life: 100 }
// Gerekçe metni üreten tüm dalları dolaşan senaryolar
const scenarios = [
  { choices: [choose("starter", ["CHARMANDER", "SQUIRTLE", "BULBASAUR", "CHIKORITA"], ["FIRE_STONE"])] },
  { choices: [choose("starter", ["LATIOS_LATIAS", "MAGIKARP"], ["UNKNOWN_ITEM"])] },
  { board: [unit("VULPIX")], choices: [choose("addPick", ["CHARMANDER", "SQUIRTLE"])] },
  { board: [unit("MAGIKARP")], choices: [choose("addPick", ["CHARMANDER", "SQUIRTLE"])] },
  { board: [unit("CHARMANDER", 1, { types: ["FIRE", "DRAGON"] })], synergies: { FIRE: 3, DRAGON: 2 }, choices: [choose("unique", ["CHARMELEON", "VULPIX", "MAGIKARP"])] },
  { board: [unit("CHARMANDER")], choices: [choose("item", [], ["FIRE_STONE", "CHARCOAL", "BLACK_BELT"])] },
  { board: [unit("CHARMANDER")], inventory: ["FOSSIL_STONE"], choices: [choose("item", [], ["CHARCOAL", "BLACK_BELT"])] },
  { board: [unit("CHARMANDER")], inventory: null, choices: [choose("item", [], ["CHARCOAL"])] },
  { board: [unit("CHARMANDER")], choices: [choose("item", [], ["UNKNOWN_ITEM"])] },
  { board: [unit("CHARMANDER"), unit("SQUIRTLE", 1, { stars: 2 })], synergies: {}, shop: ["VULPIX", "CHARMELEON", "CHARMANDER", "MAGIKARP"],
    inventory: ["FOSSIL_STONE", "CHARCOAL", "MYSTIC_WATER", "FOSSIL_STONE"] },
  { board: [unit("VULPIX")], shop: ["CHARMANDER"] }
]
const economyCases = [
  { life: 20, money: 30, level: 5, experience: 0, expNeeded: 8, maxLevel: 9 },
  { money: 18, level: 5, experience: 0, expNeeded: 8, maxLevel: 9, streak: 4 },
  { money: 70, level: 5, experience: 0, expNeeded: 8, maxLevel: 9 },
  { money: 12, level: 5, experience: 0, expNeeded: 12, maxLevel: 9 }
]
function allTexts(lang) {
  i18n.strict = true
  i18n.setLang(lang)
  const ctx = ctxFor(lang === "tr" ? gameTr : gameEn)
  const out = []
  for (const s of scenarios) {
    const snap = { ...base0, ...s }
    const board = advisor.boardAdvice(ctx, snap)
    for (const o of board.choice?.options ?? []) out.push(o.label, o.tag, ...o.reasons)
    for (const o of board.shop) out.push(o.label, o.tag, ...o.reasons)
    for (const c of board.craft) out.push(c.reason)
    const a = advisor.analyze(ctx, { ...snap, itemsProposition: ["FIRE_STONE", "CHARCOAL"], pokemonsProposition: ["CHARMANDER"] })
    for (const p of a.propositions) if (p.reason) out.push(p.reason)
    for (const p of a.shop) out.push(...p.reasons)
    for (const p of a.pool) assert.ok(["have", "comp"].includes(p.why))
  }
  // Ekonomi ipuçlarının tüm dalları
  for (const e of economyCases) out.push(...advisor.analyze(ctx, { ...base0, ...e }).economy.tips.map(([, text]) => text))
  // Item meta verisi yokken birleştirme gerekçesi
  const noItemMeta = { ...ctx, tierItems: {} }
  out.push(...advisor.boardAdvice(noItemMeta, { ...base0, board: [unit("CHARMANDER")], inventory: ["FOSSIL_STONE", "CHARCOAL"] }).craft.map((c) => c.reason))
  // Meta verisi yok
  const empty = { ...ctx, tierPokemons: {}, tierItems: {}, clusters: [] }
  out.push(...advisor.boardAdvice(empty, { ...base0, choices: [choose("starter", ["CHARMANDER"])] }).choice.options[0].reasons)
  return out.filter((text) => text !== "")
}
const enTexts = allTexts("en")
const trTexts = allTexts("tr")
assert.ok(enTexts.length > 40, `en gerekçe sayısı: ${enTexts.length}`)
assert.equal(enTexts.length, trTexts.length)
for (const text of enTexts) {
  assert.equal(typeof text, "string")
  assert.ok(!/\b(advice|panel|num)\.[a-z]/.test(text), `ham anahtar sızdı: ${text}`)
  assert.ok(!TURKISH.test(text), `İngilizce gerekçede Türkçe: ${text}`)
}
for (const text of trTexts) assert.ok(!/\b(advice|panel|num)\.[a-z]/.test(text), `ham anahtar sızdı: ${text}`)
const has = (list, part) => assert.ok(list.some((text) => text.includes(part)), `"${part}" yok:\n${list.join("\n")}`)
// Kapsanan anahtarlar (her advice.* anahtarı en az bir senaryoda üretiliyor)
for (const part of [
  "Charmander → Charizard: meta average #3.1", "In 1 meta comp (best average #3.3)", "+ Fire Stone (meta average #3.2)",
  "+ UNKNOWN_ITEM (no meta data)", "#1 most used item on Charmander in the meta", "Fire 1→2 (activates)", "Water 1→2 (next at 3)", "Copy for evolving (1/9)",
  "Same comp as Charmander on your board (average #3.3)", "Comp core: Charizard, Lapras", "Recommended item for Charmander; equip it directly",
  "Combine with Fossil Stone into Fire Stone → use on Charmander", "Couldn't read your components; crafting can't be checked",
  "No immediate use for the Pokémon on your board", "Meta item for Squirtle, average #3.5", "Fire Stone averages #3.2 in the meta",
  "core unit of a meta comp (average #3.3)", "copy for evolving (1/9)", "Rarely played in the meta / no data",
  "Your HP is low (20)", "Save 2 more gold to raise your interest to +2.", "Interest is maxed (+5).", "4-round streak",
  "Level 6 costs 8 gold and keeps your interest.", "Level 6 needs 12 gold (12 XP)", "You can reach level 6 for 8 gold.",
  "Recommended", "Good option", "Avoid", "Strong in meta", "Meta + team", "Team fit", "Weak pick", "No data"
]) has(enTexts, part)
for (const part of ["Charmander → Charizard: meta ort. 3.1 sıra", "Ateş 1→2 (tamamlar)", "Önerilen", "Meta'da az oynanıyor / veri yok", "Canın az (20)"]) has(trTexts, part)

// ---------- 5) Kodda kullanıcıya görünen sabit Türkçe metin yok ----------
// Yorumlar ve geliştirici konsolu mesajları istisna; fold() içindeki /ı/ arama normalizasyonu da.
const ALLOWED = [/console\.(info|warn|debug|error|log)\(/, /\.replace\(\/ı\/g, "i"\)/]
const sources = [
  ...codeFiles.filter((f) => f.endsWith(".js")),
  "extension/background.js"
]
for (const file of sources) {
  read(file).split("\n").forEach((line, i) => {
    const codePart = line.replace(/(^|\s)\/\/.*$/, "")
    if (!TURKISH.test(codePart) || ALLOWED.some((re) => re.test(codePart))) return
    assert.fail(`${file}:${i + 1} sabit Türkçe metin: ${line.trim()}`)
  })
}
const popupHtml = read("extension/popup/popup.html").replace(/<!--[\s\S]*?-->/g, "")
for (const line of popupHtml.split("\n")) {
  if (TURKISH.test(line)) assert.match(line, /<option value="tr" lang="tr">Türkçe<\/option>|<title>Tahta Koçu<\/title>/, `popup.html sabit Türkçe: ${line.trim()}`)
}
// popup.html'de data-i18n'siz görünür metin yok (marka bağlantıları, dil adları ve sembol hariç)
const visible = popupHtml
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<title>[\s\S]*?<\/title>/g, "")
  .replace(/<[^>]+>/g, "\n")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean)
assert.deepEqual(visible.filter((s) => !["English", "Türkçe", "badblli", "GitHub", "·"].includes(s)), [])

console.log(`i18n.test.mjs: ${Object.keys(en).length} anahtar, ${enTexts.length} en / ${trTexts.length} tr gerekçe, sabit metin taraması geçti`)
