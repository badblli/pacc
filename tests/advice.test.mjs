import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import test from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const data = JSON.parse(read("extension/data/static.json"))
globalThis.window = {}
vm.runInThisContext(read("extension/content/i18n.js"), { filename: "i18n.js" })
vm.runInThisContext(read("extension/content/advisor.js"), { filename: "advisor.js" })
const advisor = window.PacAdvisor
// Gerekçeler Türkçe katalogla üretilir; eksik anahtar / değişken hata fırlatır (İngilizce kapsam: i18n.test.mjs).
const i18n = window.PacI18n
i18n.register("en", JSON.parse(read("extension/i18n/en.json")))
i18n.register("tr", JSON.parse(read("extension/i18n/tr.json")))
i18n.strict = true
await i18n.setLang("tr")
const ctx = {
  t: (key, vars) => i18n.t(key, vars),
  data,
  minGames: 20,
  thresholds: { FIRE: [2, 4, 6], DRAGON: [3, 6], WATER: [3, 6] },
  tierPokemons: {
    CHARIZARD: [3.1, 100, 2, ["FIRE_STONE", "LEFTOVERS"]],
    CHARMELEON: [3.8, 30, 1, []],
    BLASTOISE: [3.4, 80, 2, ["WATER_STONE"]],
    VENUSAUR: [5.7, 50, 1, []],
    LATIOS: [3.2, 40, 1, []],
    LATIAS: [4.2, 40, 1, []],
    CHIKORITA: [1.1, 2, 0, []]
  },
  clusters: [
    { id: "fire", count: 80, rank: 3.3, winrate: 0.3, synergies: [],
      pokemons: [{ name: "CHARIZARD", frequency: 0.8, items: [] }], items: [{ item: "FIRE_STONE" }] },
    { id: "water", count: 60, rank: 3.5, winrate: 0.2, synergies: [],
      pokemons: [{ name: "BLASTOISE", frequency: 0.7, items: [] }], items: [] },
    // Bu iki küme örnek/frekans eşiği altında olduğu için başlangıç puanına katılmaz.
    { id: "rare", count: 2, rank: 1, pokemons: [{ name: "VENUSAUR", frequency: 1 }], items: [] },
    { id: "infrequent", count: 80, rank: 1, pokemons: [{ name: "VENUSAUR", frequency: 0.1 }], items: [] }
  ],
  tierItems: { FIRE_STONE: [3.2, 80, []], WATER_STONE: [3.5, 60, []], BLACK_BELT: [5.8, 80, []] },
  names: {
    pkm: (key) => ({ CHARIZARD: "Charizard", CHARMANDER: "Charmander" })[key] ?? key,
    syn: (key) => ({ FIRE: "Ateş", DRAGON: "Ejderha", WATER: "Su" })[key] ?? key,
    item: (key) => ({ FIRE_STONE: "Ateş Taşı", WATER_STONE: "Su Taşı" })[key] ?? key
  }
}
const snap = {
  board: [], shop: [], choices: [], inventory: [], synergies: {},
  itemsProposition: [], pokemonsProposition: [], level: 3, money: 20, life: 100
}
const choose = (type, pokemons = [], items = []) => ({ id: `test-${type}`, type, pokemons, items, costs: [] })
const advice = (choice, overrides = {}, context = ctx) => advisor.boardAdvice(context, { ...snap, ...overrides, choices: choice ? [choice] : [] })
const labels = { best: "Önerilen", good: "İyi seçenek", avoid: "Kaçın", neutral: "" }
function contract(result) {
  const tags = ["Meta + takım", "Takım uyumu", "Meta güçlü", "Zayıf seçim", "Veri yok"]
  const pctOk = (pct) => pct === null || (Number.isInteger(pct) && pct >= 0 && pct <= 100)
  assert.deepEqual(Object.keys(result).sort(), ["choice", "craft", "shop"])
  if (result.choice) {
    assert.deepEqual(Object.keys(result.choice).sort(), ["id", "kind", "options", "type"])
    assert.ok(["pokemon", "item"].includes(result.choice.kind))
    for (const [index, option] of result.choice.options.entries()) {
      assert.deepEqual(Object.keys(option).sort(), ["index", "label", "pct", "reasons", "score", "tag", "verdict"])
      assert.ok(pctOk(option.pct))
      assert.ok(tags.includes(option.tag))
      assert.equal(option.pct === null, option.tag === "Veri yok")
      assert.equal(option.index, index)
      assert.ok(Number.isFinite(option.score))
      assert.equal(option.label, labels[option.verdict])
      assert.ok(option.reasons.length <= 3)
      assert.ok(option.reasons.every((reason) => typeof reason === "string" && reason.length < 180))
    }
    const options = result.choice.options
    assert.ok(options.filter((o) => o.verdict === "best").length <= 1)
    // Kararlar pct ile tutarlı
    const best = options.find((o) => o.verdict === "best")
    if (best) assert.ok(options.every((o) => (o.pct ?? 0) <= best.pct))
    for (const o of options.filter((o) => o.verdict === "avoid")) {
      assert.ok((o.pct ?? 0) <= 40 && best.pct - (o.pct ?? 0) >= 25)
    }
  }
  for (const slot of result.shop) {
    assert.deepEqual(Object.keys(slot).sort(), ["index", "label", "pct", "reasons", "tag", "verdict"])
    assert.ok(pctOk(slot.pct))
    assert.ok(tags.includes(slot.tag))
    assert.ok(["good", "neutral"].includes(slot.verdict))
    assert.equal(slot.label, labels[slot.verdict])
    assert.ok(slot.reasons.length <= 3)
  }
  assert.ok(Array.isArray(result.craft))
  for (const plan of result.craft) {
    assert.deepEqual(Object.keys(plan).sort(), ["components", "item", "pct", "reason", "target", "targetIndex"])
    assert.equal(plan.components.length, 2)
    assert.ok(pctOk(plan.pct) && plan.pct !== null)
    assert.equal(typeof plan.reason, "string")
  }
  return result
}

const starter = choose("starter", ["CHARMANDER", "SQUIRTLE", "BULBASAUR", "CHIKORITA"])
const initial = contract(advice(starter))
assert.equal(initial.choice.id, starter.id)
assert.equal(initial.choice.type, "starter")
assert.equal(initial.choice.kind, "pokemon")
assert.equal(initial.choice.options[0].verdict, "best")
assert.equal(initial.choice.options[1].verdict, "good")
assert.equal(initial.choice.options[2].verdict, "avoid")
assert.equal(initial.choice.options[3].verdict, "avoid")
assert.ok(initial.choice.options[0].reasons.some((r) => r.includes("Charmander → Charizard: meta ort. 3.1 sıra")))
assert.ok(initial.choice.options[0].reasons.some((r) => r.includes("1 meta dizilim")))
const eligibleOnly = { ...ctx, clusters: ctx.clusters.slice(0, 2) }
assert.deepEqual(advice(starter, {}, eligibleOnly), initial)
const popular = advice(starter, {}, { ...ctx, tierPokemons: { ...ctx.tierPokemons, CHARIZARD: [3.1, 1000, 2, []] } })
assert.ok(popular.choice.options[0].score > initial.choice.options[0].score)
assert.ok(popular.choice.options[0].score - initial.choice.options[0].score < 0.4)
const bonus = contract(advice({ ...starter, items: ["FIRE_STONE"] }))
assert.ok(bonus.choice.options[0].score > initial.choice.options[0].score)
assert.ok(bonus.choice.options[0].reasons.some((r) => r.includes("+ Ateş Taşı")))

const team = [{ name: "CHARMANDER", y: 1, x: 1, stars: 1, items: [], types: ["FIRE", "DRAGON"] }]
const teamState = { board: team, synergies: { FIRE: 3, DRAGON: 2 } }
const unit = (name, y = 1) => ({ name, y, x: 1, stars: 1, items: [], types: [] })
const fireTeam = { board: [unit("VULPIX")], synergies: {} }
const waterTeam = { board: [unit("MAGIKARP")], synergies: {} }
const teamChoice = choose("addPick", ["CHARMANDER", "SQUIRTLE"])
const fireChoice = contract(advice(teamChoice, fireTeam))
const waterChoice = contract(advice(teamChoice, waterTeam))
assert.equal(fireChoice.choice.options[0].verdict, "best")
assert.equal(waterChoice.choice.options[1].verdict, "best")
assert.ok(fireChoice.choice.options[0].reasons.some((reason) => reason.includes("Ateş 1→2 (tamamlar)")))
assert.ok(waterChoice.choice.options[1].reasons.some((reason) => reason.includes("Su 1→2 (eşik 3)")))
assert.equal(advice(teamChoice, { board: [unit("VULPIX", 0)], synergies: {} }).choice.options[0].score,
  advice(teamChoice).choice.options[0].score)
const duo = contract(advice(choose("addPick", ["LATIOS_LATIAS", "MAGIKARP"]), teamState))
assert.equal(duo.choice.options[0].verdict, "best")
const latios = advice(choose("addPick", ["LATIOS"]), teamState).choice.options[0].score
const latias = advice(choose("addPick", ["LATIAS"]), teamState).choice.options[0].score
assert.equal(duo.choice.options[0].score, (latios + latias) / 2)
assert.ok(duo.choice.options[0].reasons.some((r) => r.includes("Ejderha 2→3 (tamamlar)")))
const duoBonus = advice(choose("addPick", ["LATIOS_LATIAS", "MAGIKARP"], ["FIRE_STONE"]), teamState)
assert.ok(duoBonus.choice.options[0].score > duo.choice.options[0].score)
const starterDuo = advice(choose("starter", ["LATIOS_LATIAS"])).choice.options[0].score
assert.equal(starterDuo, (advice(choose("starter", ["LATIOS"])).choice.options[0].score +
  advice(choose("starter", ["LATIAS"])).choice.options[0].score) / 2)
const duplicate = advice(choose("unique", ["CHARMELEON"]), teamState)
assert.ok(!duplicate.choice.options[0].reasons.some((r) => r.includes("sinerji")))
const firstOnly = contract(advisor.boardAdvice(ctx, { ...snap, choices: [starter, choose("item", [], ["FIRE_STONE"])] }))
assert.equal(firstOnly.choice.id, starter.id)

const itemChoice = choose("item", [], ["FIRE_STONE", "CHARCOAL", "BLACK_BELT", "UNKNOWN_ITEM"])
const itemResult = contract(advice(itemChoice, teamState))
assert.equal(itemResult.choice.kind, "item")
assert.equal(itemResult.choice.options[0].verdict, "best")
assert.equal(itemResult.choice.options[2].verdict, "neutral")
assert.equal(itemResult.choice.options[3].verdict, "neutral")
assert.ok(itemResult.choice.options[0].reasons.some((r) => r.includes("Charmander için önerilen item")))
assert.equal(itemResult.choice.options[1].score, 0)
const craftPick = contract(advice(choose("item", [], ["CHARCOAL", "BLACK_BELT"]),
  { ...teamState, inventory: ["FOSSIL_STONE"] }))
assert.equal(craftPick.choice.options[0].verdict, "best")
assert.ok(craftPick.choice.options[0].reasons.some((r) => r.includes("FOSSIL_STONE ile Ateş Taşı yap → Charmander için kullan")))
assert.equal(advice(choose("item", [], ["CHARCOAL", "BLACK_BELT"]),
  { ...teamState, inventory: null }).choice.options[0].verdict, "neutral")
assert.ok(advice(choose("item", [], ["CHARCOAL"]), { ...teamState, inventory: null })
  .choice.options[0].reasons[0].includes("birleşim doğrulanamadı"))
const teamItems = choose("item", [], ["FIRE_STONE", "WATER_STONE"])
assert.equal(advice(teamItems, { board: [unit("CHARMANDER")], synergies: {} }).choice.options[0].verdict, "best")
assert.equal(advice(teamItems, { board: [unit("SQUIRTLE")], synergies: {} }).choice.options[1].verdict, "best")
assert.deepEqual(contract(advice(choose("item", [], ["FIRE_STONE", "FIRE_STONE"]))).choice.options.map((o) => o.verdict), ["neutral", "neutral"])
assert.equal(contract(advice(null)).choice, null)
assert.equal(contract(advisor.boardAdvice(ctx, { ...snap, choices: undefined })).choice, null)

const emptyMeta = { ...ctx, tierPokemons: {}, tierItems: undefined, clusters: [], names: undefined }
for (const type of ["starter", "addPick", "unique", "legendary"]) {
  const result = contract(advice(choose(type, ["CHARMANDER", "SQUIRTLE", "BULBASAUR"]), {}, emptyMeta))
  assert.ok(result.choice.options.every((o) => o.verdict === "neutral" && o.score === 0 && o.reasons[0] === "Meta'da az oynanıyor / veri yok"))
}
for (const type of ["item", "wand", "gifts", "form_change", "mission_order"]) {
  const result = contract(advice(choose(type, [], ["UNKNOWN_ITEM", "OTHER_ITEM"]), {}, emptyMeta))
  assert.ok(result.choice.options.every((o) => o.verdict === "neutral"))
  assert.ok(contract(advice(choose(type, [], ["FIRE_STONE", "BLACK_BELT"]))).choice.options.every((o) => o.verdict === "neutral"))
}
const rawNames = advice(choose("starter", ["CHARMANDER", "BULBASAUR"]), {}, { ...ctx, names: undefined })
assert.ok(rawNames.choice.options[0].reasons[0].includes("CHARIZARD"))
const thresholdMeta = { ...ctx, clusters: [], tierPokemons: {
  CHARIZARD: [3, 100, 0, []], BLASTOISE: [3.6, 100, 0, []],
  VENUSAUR: [4.2, 100, 0, []], CHIKORITA: [4.6, 100, 0, []]
} }
const thresholdResult = contract(advice(starter, {}, thresholdMeta))
// Meta sırası doğrusal: 3 → %71, 3.6 → %63, 4.2 → %54, 4.6 → %49 (avoid için ≤ 40 gerekir)
assert.deepEqual(thresholdResult.choice.options.map((o) => o.pct), [71, 63, 54, 49])
assert.deepEqual(thresholdResult.choice.options.map((o) => o.verdict), ["best", "good", "neutral", "neutral"])
const absoluteGap = contract(advice(choose("legendary", ["CHARMANDER", "SQUIRTLE", "BULBASAUR"]), {}, {
  ...ctx, clusters: [], tierPokemons: { CHARIZARD: [3, 100, 0, []], BLASTOISE: [3.4, 100, 0, []], VENUSAUR: [5.6, 100, 0, []] }
}))
assert.deepEqual(absoluteGap.choice.options.map((o) => o.verdict), ["best", "good", "avoid"])
// Avoid eşiği: pct ≤ 40 ama best'e 25 puandan yakınsa kaçın denmez.
const closeWeak = contract(advice(choose("legendary", ["CHARMANDER", "SQUIRTLE"]), {}, {
  ...ctx, clusters: [], tierPokemons: { CHARIZARD: [5.2, 100, 0, []], BLASTOISE: [6.5, 100, 0, []] }
}))
assert.deepEqual(closeWeak.choice.options.map((o) => o.pct), [40, 21])
assert.deepEqual(closeWeak.choice.options.map((o) => o.verdict), ["best", "neutral"])
const farWeak = contract(advice(choose("legendary", ["CHARMANDER", "SQUIRTLE"]), {}, {
  ...ctx, clusters: [], tierPokemons: { CHARIZARD: [3, 100, 0, []], BLASTOISE: [5.3, 100, 0, []] }
}))
assert.deepEqual(farWeak.choice.options.map((o) => [o.pct, o.verdict]), [[71, "best"], [39, "avoid"]])
const farButHigh = contract(advice(choose("legendary", ["CHARMANDER", "SQUIRTLE"]), {}, {
  ...ctx, clusters: [], tierPokemons: { CHARIZARD: [1, 100, 0, []], BLASTOISE: [4, 100, 0, []] }
}))
assert.deepEqual(farButHigh.choice.options.map((o) => [o.pct, o.verdict]), [[100, "best"], [57, "neutral"]])

const shopResult = contract(advice(null, { ...teamState, shop: ["DEFAULT", "CHARMELEON", "VULPIX", "CHIKORITA", "", "VULPIX"] }))
assert.deepEqual(shopResult.shop.map((s) => s.index), [1, 2, 3, 5])
assert.deepEqual(shopResult.shop.map((s) => s.verdict), ["good", "neutral", "neutral", "neutral"])
assert.ok(shopResult.shop[0].reasons.some((reason) => reason.includes("evrim için kopya")))
assert.deepEqual(shopResult.shop[1].reasons, []) // Salt Ateş eşleşmesi öneri değildir.
assert.ok(!shopResult.shop[0].reasons.some((r) => r.includes("tamamlar")))
const metaShopCtx = { ...ctx, clusters: [{ id: "fire-core", count: 80, rank: 3.2,
  pokemons: [{ name: "CHARIZARD", frequency: 0.8 }, { name: "VULPIX", frequency: 0.7 }], items: [] }] }
const metaShop = contract(advice(null, { ...teamState, shop: ["VULPIX", "CHIKORITA"] }, metaShopCtx))
assert.equal(metaShop.shop[0].verdict, "good")
assert.ok(metaShop.shop[0].reasons.some((reason) => reason.includes("meta diziliminde çekirdek")))
assert.ok(metaShop.shop[0].reasons.some((reason) => reason.includes("Ateş 3→4 (tamamlar)")))
assert.equal(metaShop.shop[1].verdict, "neutral")
const fullyOwned = contract(advice(null, { board: [{ ...unit("CHARIZARD"), stars: 3 }], shop: ["CHARMANDER"], synergies: {} }))
assert.equal(fullyOwned.shop[0].verdict, "neutral")
const benchOnly = contract(advice(null, { board: [unit("CHARMANDER", 0)], shop: ["CHARMELEON"], synergies: {} }))
assert.equal(benchOnly.shop[0].verdict, "neutral")
const teamShop = contract(advice(null, { ...waterTeam, shop: ["SQUIRTLE", "DEFAULT"] }))
assert.deepEqual(teamShop.shop.map((entry) => entry.verdict), ["neutral"])

// ---------- Yüzdeli uyum (pct / tag) ----------
// Başlangıç: takım yok → meta ağırlıklı; pct sırası meta sırasını izler, veri yoksa null.
assert.deepEqual(initial.choice.options.map((o) => o.pct), [75, 71, 33, null])
assert.deepEqual(initial.choice.options.map((o) => o.tag), ["Meta güçlü", "Meta güçlü", "Zayıf seçim", "Veri yok"])
assert.ok(bonus.choice.options[0].pct > initial.choice.options[0].pct) // bonus item katkısı
assert.ok(advice(choose("starter", ["CHARMANDER", "SQUIRTLE"]), {}, emptyMeta).choice.options
  .every((o) => o.pct === null && o.tag === "Veri yok"))
// Takım uyumu pct'yi belirgin artırır: Ateş takımında Charmander, Su takımındakinden çok daha yüksek.
const charFire = fireChoice.choice.options[0]
const charWater = waterChoice.choice.options[0]
assert.ok(charFire.pct - charWater.pct >= 10, `${charFire.pct} vs ${charWater.pct}`)
assert.ok(waterChoice.choice.options[1].pct > fireChoice.choice.options[1].pct)
assert.equal(charFire.tag, "Meta + takım")
// Meta dizilim çekirdeği: tahtadaki Charmander ile aynı dizilimdeki Vulpix
const compCtx = { ...ctx, clusters: [{ id: "fire-core", count: 80, rank: 3.2,
  pokemons: [{ name: "CHARIZARD", frequency: 0.8 }, { name: "VULPIX", frequency: 0.7 }, { name: "LAPRAS", frequency: 0.5 }], items: [] }] }
const compPick = choose("addPick", ["VULPIX", "SQUIRTLE"])
const withComp = contract(advice(compPick, { board: [unit("CHARMANDER")], synergies: {} }, compCtx))
const withoutComp = contract(advice(compPick, { board: [unit("CHARMANDER")], synergies: {} }, { ...ctx, clusters: [] }))
assert.ok(withComp.choice.options[0].pct - withoutComp.choice.options[0].pct >= 15)
assert.equal(withComp.choice.options[0].verdict, "best")
assert.equal(withComp.choice.options[0].tag, "Takım uyumu")
assert.equal(withComp.choice.options[0].reasons[0], "Tahtandaki Charmander ile aynı dizilim (ort. 3.2)")
assert.ok(withComp.choice.options[0].reasons.includes("Dizilim çekirdeği: Charizard, LAPRAS"))
// Aynı aile kopyası (evrim) takım puanı verir ama sinerji gerekçesi vermez.
const copyPick = contract(advice(choose("unique", ["CHARMELEON"]), { board: [unit("CHARMANDER")], synergies: {} }))
assert.ok(copyPick.choice.options[0].reasons.includes("Evrim için kopya (1/9)"))
assert.ok(!copyPick.choice.options[0].reasons.some((r) => r.includes("tamamlar")))
// Item seçimi: hemen verilen > birleşip verilen > kullanımı olmayan
assert.equal(itemResult.choice.options[0].pct, 87)
assert.equal(itemResult.choice.options[0].tag, "Meta + takım")
assert.equal(itemResult.choice.options[1].pct, null) // CHARCOAL: kullanım ve meta yok
assert.equal(itemResult.choice.options[2].pct, 13) // BLACK_BELT: yalnız zayıf meta
assert.equal(itemResult.choice.options[2].verdict, "neutral") // kullanımı yoksa kaçın denmez
assert.equal(craftPick.choice.options[0].pct, 78)
assert.equal(craftPick.choice.options[0].tag, "Meta + takım")
// Dükkan: good olmayan slotlar da puan alır.
assert.ok(shopResult.shop.every((slot) => slot.pct !== undefined && typeof slot.tag === "string"))
assert.ok(metaShop.shop[0].pct > metaShop.shop[1].pct)
assert.deepEqual(contract(advice(null, { shop: ["CHARMANDER", "BULBASAUR"] })).shop.map((s) => s.pct), [70, 33])
// Evrim adı: dükkanda Charmander görünür, meta çekirdeği Charizard.
const evoShop = contract(advice(null, { board: [unit("VULPIX")], synergies: {}, shop: ["CHARMANDER"] }, { ...metaShopCtx,
  clusters: [{ ...metaShopCtx.clusters[0], pokemons: [{ name: "VULPIX", frequency: 0.8 }, { name: "CHARIZARD", frequency: 0.7 }] }] }))
assert.ok(evoShop.shop[0].reasons.some((r) => r.startsWith("Charmander → Charizard: meta diziliminde çekirdek")))

// ---------- Evrim ailesi ----------
const chain = ["CHARMANDER", "CHARMELEON", "CHARIZARD"]
for (const name of chain) assert.deepEqual(advisor.familyChain(data, name), chain)
assert.deepEqual(advisor.familyChain(data, "RALTS"), ["RALTS", "KIRLIA", "GALLADE", "GARDEVOIR"])
assert.deepEqual(advisor.familyChain(data, "NOT_A_POKEMON"), ["NOT_A_POKEMON"])

// ---------- Item birleştirme planı (craft) ----------
const craftBoard = [
  { ...unit("CHARMANDER"), x: 1 },
  { ...unit("SQUIRTLE"), stars: 2, x: 2 },
  { ...unit("BLASTOISE", 0), x: 3 } // yedekte: hedef olamaz
]
// İki tarif aynı FOSSIL_STONE'u istiyor: yalnız biri yapılır (en yüksek pct: 2★ Squirtle'a Su Taşı).
const conflict = contract(advice(null, { board: craftBoard, synergies: {}, inventory: ["FOSSIL_STONE", "CHARCOAL", "MYSTIC_WATER"] }))
assert.deepEqual(conflict.craft, [{ item: "WATER_STONE", components: ["FOSSIL_STONE", "MYSTIC_WATER"],
  target: "SQUIRTLE", targetIndex: 1, pct: 90, reason: "SQUIRTLE için meta item, ort. 3.5 sıra" }])
const both = contract(advice(null, { board: craftBoard, synergies: {}, inventory: ["FOSSIL_STONE", "CHARCOAL", "MYSTIC_WATER", "FOSSIL_STONE"] }))
assert.deepEqual(both.craft.map((c) => [c.item, c.targetIndex]), [["WATER_STONE", 1], ["FIRE_STONE", 0]])
assert.equal(both.craft[1].reason, "Charmander için meta item, ort. 3.2 sıra")
assert.equal(both.craft.flatMap((c) => c.components).filter((c) => c === "FOSSIL_STONE").length, 2) // parça başına tek kullanım
// Itemi zaten takmış ya da 3 itemi olan hedef seçilmez; yedek hedef olmaz.
const holder = [{ ...unit("CHARMANDER"), items: ["FIRE_STONE"] }, { ...unit("SQUIRTLE"), items: ["A", "B", "C"] }]
assert.deepEqual(contract(advice(null, { board: holder, synergies: {}, inventory: ["FOSSIL_STONE", "CHARCOAL", "MYSTIC_WATER"] })).craft, [])
assert.deepEqual(contract(advice(null, { board: [unit("CHARMANDER", 0)], synergies: {}, inventory: ["FOSSIL_STONE", "CHARCOAL"] })).craft, [])
// Envanter yok / okunamadı
for (const inventory of [[], null, undefined]) {
  assert.deepEqual(contract(advice(null, { board: craftBoard, synergies: {}, inventory })).craft, [])
}

// Eski panel API'leri aynı verilerle çalışmayı ve seçimden bağımsız kalmayı sürdürür.
const legacySnap = { ...snap, ...teamState, shop: ["CHARMANDER"], itemsProposition: ["FIRE_STONE"], pokemonsProposition: ["LATIOS_LATIAS"] }
const before = advisor.analyze(ctx, legacySnap)
const summary = advisor.summarize(ctx, legacySnap)
advisor.boardAdvice(ctx, { ...legacySnap, choices: [starter] })
assert.deepEqual(advisor.analyze(ctx, legacySnap).pokemonPropositions, before.pokemonPropositions)
assert.deepEqual(advisor.summarize(ctx, legacySnap), summary)
assert.equal(before.pokemonPropositions[0].option, "LATIOS_LATIAS")
assert.equal(before.propositions[0].item, "FIRE_STONE")
assert.equal(before.shop[0].slot, 0)
assert.equal(summary.units[0].unit.name, "CHARMANDER")
assert.equal(advisor.analyze(ctx, { ...legacySnap, ...fireTeam, pokemonsProposition: teamChoice.pokemons })
  .pokemonPropositions[0].option, "CHARMANDER")
assert.equal(advisor.analyze(ctx, { ...legacySnap, ...waterTeam, pokemonsProposition: teamChoice.pokemons })
  .pokemonPropositions[0].option, "SQUIRTLE")
assert.equal(advisor.analyze(ctx, { ...legacySnap, ...waterTeam, shop: ["SQUIRTLE"] }).shop.length, 0)

// Kancayı tarayıcı olmadan çalıştırıp Redux / Colyseus koleksiyonlarını doğrular.
const hookSource = read("extension/page/game-hook.js")
function hookSnapshot({ reduxChoices, reduxBoard = [], reduxSynergies = {}, liveChoices,
  liveBoard = reduxBoard, liveSynergies = reduxSynergies, legacy = false, live = false }) {
  const reduxPlayer = { id: "test-player", board: reduxBoard, synergies: reduxSynergies, choices: reduxChoices }
  const state = { network: { uid: "test-player" }, game: { players: [reduxPlayer], shop: [],
    ...(legacy ? { pokemonsProposition: ["OLD_PKM"], itemsProposition: ["OLD_ITEM"] } : {}) } }
  const messages = []
  let tick
  const sandbox = vm.createContext({
    window: { addEventListener() {}, postMessage: (message) => messages.push(message) },
    document: { getElementById: () => ({ "__reactContainer$test": { memoizedProps: { store: { getState: () => state } } } }) },
    location: { pathname: "/game/test", origin: "https://example.test" },
    setInterval: (callback) => { tick = callback }, console
  })
  vm.runInContext(hookSource, sandbox)
  if (live) {
    sandbox.liveState = { players: new Map([["test-player", { ...reduxPlayer, board: liveBoard,
      synergies: liveSynergies, choices: liveChoices }]]), simulations: {}, floatingItems: [] }
    vm.runInContext("new Map().set(0, liveState)", sandbox)
  }
  tick()
  tick()
  assert.equal(messages.filter((message) => message.type === "pac-yardimci:game").length, 1)
  assert.equal(messages.filter((message) => message.type === "pac-yardimci:health").length, 2)
  assert.equal(messages.at(-1).status, "ok")
  return JSON.parse(JSON.stringify(messages.find((message) => message.type === "pac-yardimci:game").snapshot))
}
const collection = (values) => ({ forEach: (fn) => values.forEach(fn) })
const liveChoice = { id: "live", type: "starter", pokemons: collection(["CHARMANDER", "SQUIRTLE"]), items: collection(["FIRE_STONE"]), costs: collection([0, 1]) }
const queuedItem = choose("item", [], ["WATER_STONE"])
const captured = hookSnapshot({ reduxChoices: [choose("unique", ["BULBASAUR"])], live: true, liveChoices: collection([liveChoice, queuedItem]), legacy: true })
assert.deepEqual(captured.choices, [{ id: "live", type: "starter", pokemons: ["CHARMANDER", "SQUIRTLE"], items: ["FIRE_STONE"], costs: [0, 1] }, queuedItem])
assert.deepEqual(captured.pokemonsProposition, ["CHARMANDER", "SQUIRTLE"])
assert.deepEqual(captured.itemsProposition, ["WATER_STONE"])
assert.deepEqual(hookSnapshot({ reduxChoices: [starter] }).choices, [starter])
assert.deepEqual(hookSnapshot({ reduxChoices: [starter], live: true }).choices, [starter])
assert.deepEqual(hookSnapshot({ reduxChoices: [starter], live: true, liveChoices: [] }).choices, [])
const fallback = hookSnapshot({ legacy: true })
assert.deepEqual(fallback.choices, [])
assert.deepEqual(fallback.pokemonsProposition, ["OLD_PKM"])
assert.deepEqual(fallback.itemsProposition, ["OLD_ITEM"])
assert.deepEqual(hookSnapshot({ reduxChoices: [choose("item")], legacy: true }).itemsProposition, [])
assert.deepEqual(hookSnapshot({}).pokemonsProposition, [])
assert.deepEqual(hookSnapshot({}).itemsProposition, [])
const reduxSnapshot = hookSnapshot({ reduxBoard: { one: { name: "VULPIX", positionX: 1, positionY: 1,
  stars: 1, items: [], types: { first: "FIRE" } } }, reduxSynergies: { FIRE: 1 } })
assert.deepEqual(reduxSnapshot.board.map((pokemon) => ({ name: pokemon.name, y: pokemon.y, types: pokemon.types })),
  [{ name: "VULPIX", y: 1, types: ["FIRE"] }])
assert.deepEqual(reduxSnapshot.synergies, { FIRE: 1 })
const liveSnapshot = hookSnapshot({ live: true, liveBoard: new Map([["one", { name: "MAGIKARP", positionX: 2,
  positionY: 1, stars: 1, items: [], types: new Set(["WATER"]) }]]), liveSynergies: new Map([["WATER", 1]]) })
assert.deepEqual(liveSnapshot.board.map((pokemon) => ({ name: pokemon.name, y: pokemon.y, types: pokemon.types })),
  [{ name: "MAGIKARP", y: 1, types: ["WATER"] }])
assert.deepEqual(liveSnapshot.synergies, { WATER: 1 })

// ---------- Planlayıcı: saf API sözleşmesi ----------
const planned = (name, x = 3, y = 1, items = []) => ({ name, x, y, items })
const plannerCluster = { id: "planner-core", count: 100, rank: 3,
  pokemons: [{ name: "CHARIZARD", frequency: 0.8 }, { name: "BLASTOISE", frequency: 0.6 },
    { name: "VENUSAUR", frequency: 0.4 }, { name: "NINETALES", frequency: 0.24 }] }
const plannerCtx = { ...ctx, clusters: [plannerCluster] }
const pctValid = (pct) => Number.isInteger(pct) && pct >= 0 && pct <= 100
function planContract(plan) {
  const squares = new Set()
  for (const p of plan) {
    assert.equal(typeof p.name, "string")
    assert.ok(Number.isInteger(p.x) && p.x >= 0 && p.x <= 7)
    assert.ok(Number.isInteger(p.y) && p.y >= 1 && p.y <= 3)
    assert.ok(Array.isArray(p.items) && p.items.length <= 3)
    assert.ok(!squares.has(`${p.x},${p.y}`))
    squares.add(`${p.x},${p.y}`)
  }
  return plan
}

test("planFit: frekans ağırlığı, aile eşleşmesi ve en iyi üç dizilim", () => {
  const plan = [planned("CHARMANDER"), planned("CHARMELEON", 4)]
  const fit = advisor.planFit(plannerCtx, plan)
  assert.deepEqual(Object.keys(fit).sort(), ["best", "missing", "synergies"])
  assert.equal(fit.best[0].fit, 44) // 0.8 / (0.8 + 0.6 + 0.4)
  assert.deepEqual(fit.best[0].owned, ["CHARIZARD"])
  assert.deepEqual(fit.best[0].missing, ["BLASTOISE", "VENUSAUR"])
  assert.deepEqual(fit.missing, [{ pkm: "BLASTOISE", why: "comp" }, { pkm: "VENUSAUR", why: "comp" }])
  assert.equal(advisor.planFit(plannerCtx, [planned("CHARIZARD")]).best[0].fit, 44)
  assert.equal(advisor.planFit(plannerCtx, [planned("CHARMANDER"), planned("SQUIRTLE", 4), planned("BULBASAUR", 5)]).best[0].fit, 100)
  const variants = [5, 2, 4, 3].map((rank) => ({ ...plannerCluster, id: `rank-${rank}`, rank }))
  const best = advisor.planFit({ ...plannerCtx, clusters: [...variants, { ...plannerCluster, count: 1 }] }, plan).best
  assert.deepEqual(best.map((p) => p.cluster.rank), [2, 3, 4])
  assert.ok(best.every((p) => pctValid(p.fit)))
  assert.equal(advisor.planFit(plannerCtx, []).best[0].fit, 0)
})

test("planFit: aynı ailedeki formların ağırlığı ve eksikleri tekrarlanmaz", () => {
  const cluster = { ...plannerCluster, pokemons: [{ name: "CHARIZARD", frequency: 0.5 },
    { name: "CHARMELEON", frequency: 0.3 }, { name: "BLASTOISE", frequency: 0.8 }] }
  const context = { ...plannerCtx, clusters: [cluster] }
  assert.equal(advisor.planFit(context, [planned("CHARMANDER")]).best[0].fit, 50)
  assert.deepEqual(advisor.planFit(context, []).best[0].missing, ["BLASTOISE", "CHARIZARD"])
})

test("planFit: sinerji aile başına tür birleşimi, yedek hariç ve item bonusları", () => {
  const context = { ...plannerCtx, data: { ...data, itemTypes: { WATER_STONE: "WATER", FIRE_GEM: ["FIRE"] } } }
  const plan = [planned("CHARMANDER", 0, 1, ["WATER_STONE", "FIRE_GEM"]),
    planned("CHARIZARD", 1, 1, ["WATER_STONE"]), planned("SQUIRTLE", 2),
    planned("BLASTOISE", 3, 0, ["FIRE_GEM"]), planned("VULPIX", 4, 0)]
  const get = (units) => advisor.planFit(context, units).synergies
  const counts = Object.fromEntries(get(plan).map((s) => [s.syn, s.count]))
  assert.equal(counts.FIRE, 1)
  assert.equal(counts.DRAGON, 1)
  assert.equal(counts.FLYING, 1)
  assert.equal(counts.WATER, 2)
  assert.deepEqual(get(plan), get([...plan].reverse()))
  assert.deepEqual(get(plan).find((s) => s.syn === "WATER"), { syn: "WATER", count: 2, next: 3, need: 1 })
  assert.equal(advisor.planFit(plannerCtx, plan).synergies.find((s) => s.syn === "WATER").count, 1)
  const maxed = advisor.planFit({ ...context, thresholds: { FIRE: [1] } }, plan).synergies.find((s) => s.syn === "FIRE")
  assert.deepEqual(maxed, { syn: "FIRE", count: 1, next: null, need: 0 })
})

test("planRecommendations: çekirdek ve dükkan adayları, gerekçeler, sınır ve meta katkısı", () => {
  const plan = [planned("CHARMANDER")]
  const before = JSON.stringify({ plannerCtx, plan })
  const recs = advisor.planRecommendations(plannerCtx, plan, { limit: 1000 })
  assert.ok(recs.some((p) => p.pkm === "BLASTOISE" && p.reasons.some((r) => r.kind === "comp")))
  assert.ok(recs.some((p) => p.reasons.some((r) => r.kind === "next" && r.syn === "FIRE")))
  assert.ok(recs.some((p) => p.reasons.some((r) => r.kind === "syn" && r.syn === "DRAGON")))
  assert.ok(!recs.some((p) => advisor.familyChain(data, p.pkm).includes("CHARMANDER")))
  const families = recs.map((p) => data.family[p.pkm] ?? p.pkm)
  assert.equal(new Set(families).size, families.length)
  for (const [i, rec] of recs.entries()) {
    assert.deepEqual(Object.keys(rec).sort(), ["fit", "pkm", "rarity", "reasons"])
    assert.ok(pctValid(rec.fit))
    assert.equal(rec.rarity, data.pokemons[rec.pkm][0])
    assert.ok(rec.reasons.every((r) => ["comp", "next", "syn", "meta"].includes(r.kind)))
    if (i) assert.ok(recs[i - 1].fit >= rec.fit)
  }
  assert.deepEqual(advisor.planRecommendations(plannerCtx, plan, { limit: 2 }), recs.slice(0, 2))
  assert.ok(advisor.planRecommendations(plannerCtx, plan).length <= 10)
  assert.deepEqual(advisor.planRecommendations(plannerCtx, plan, { limit: 0 }), [])
  const withoutMeta = advisor.planRecommendations({ ...plannerCtx, tierPokemons: {} }, plan, { limit: 1000 })
  const blastoise = recs.find((p) => p.pkm === "BLASTOISE")
  assert.ok(blastoise.fit > withoutMeta.find((p) => p.pkm === "BLASTOISE").fit)
  assert.ok(blastoise.reasons.some((r) => r.kind === "meta"))
  assert.equal(JSON.stringify({ plannerCtx, plan }), before)
  const shopOnly = advisor.planRecommendations({ ...plannerCtx, clusters: [] }, plan, { limit: 1000 })
  assert.ok(shopOnly.length > 0)
  assert.ok(shopOnly.every((p) => {
    const d = data.pokemons[p.pkm]
    return d[1] === 1 && !d[3] && !d[4] && d[6] && data.rules.shopRarities.includes(d[0])
  }))
  const synergyOnlyCtx = { ...plannerCtx, clusters: [], tierPokemons: {}, thresholds: { FIRE: [2] } }
  const nextStep = advisor.planRecommendations(synergyOnlyCtx, plan)[0]
  const distantStep = advisor.planRecommendations({ ...synergyOnlyCtx, thresholds: { FIRE: [4] } }, plan)
    .find((p) => p.pkm === nextStep.pkm)
  assert.equal(nextStep.fit, 30)
  assert.equal(distantStep.fit, 10)
  assert.deepEqual(advisor.planRecommendations({ ...plannerCtx, clusters: [] }, []), [])
})

test("planItems: birim başına ilk üç meta itemi ve aile üzerinden yedek veri", () => {
  const context = { ...plannerCtx, tierPokemons: { CHARIZARD: [3, 100, 0, ["A", "B", "C", "D"]] } }
  const plan = [planned("CHARMANDER", 0, 1, ["HELD"]), planned("CHARMELEON", 1), planned("SQUIRTLE", 2)]
  const result = advisor.planItems(context, plan)
  assert.deepEqual(result, [{ pkm: "CHARMANDER", items: ["A", "B", "C"], have: ["HELD"] },
    { pkm: "CHARMELEON", items: ["A", "B", "C"], have: [] }, { pkm: "SQUIRTLE", items: [], have: [] }])
  result[0].have.push("OTHER")
  result[0].items.push("OTHER")
  assert.deepEqual(plan[0].items, ["HELD"])
  assert.equal(context.tierPokemons.CHARIZARD[3].length, 4)
})

test("compToPlan: son evrim, dallanma meta sıklığı, ön saf, ortalama ve sekiz birim sınırı", () => {
  const names = ["CHARMANDER", "SQUIRTLE", "BULBASAUR", "RALTS", "LAPRAS", "LATIOS", "LATIAS", "CHIKORITA", "MAGIKARP"]
  const cluster = { ...plannerCluster, pokemons: names.map((name, i) => ({ name, frequency: 1 - i * 0.05 })) }
  const context = { ...plannerCtx, data: { ...data, pokemonStats: {
    CHARIZARD: { range: 1 }, BLASTOISE: { range: 2, hp: 250 }, VENUSAUR: { range: 3, def: 40 },
    GALLADE: { range: 4, hp: 100, def: 10 }, LAPRAS: { range: 3 }, LATIOS: { range: 4 },
    LATIAS: { range: 4 }, MEGANIUM: { range: 3 }
  } }, tierPokemons: { ...ctx.tierPokemons, CHARMANDER: [3, 10000, 0, []],
    GALLADE: [3, 200, 0, ["A", "B", "C", "D"]], GARDEVOIR: [2, 100, 0, []] } }
  const snapshot = JSON.stringify({ context, cluster })
  const plan = planContract(advisor.compToPlan(context, cluster))
  assert.equal(plan.length, 8)
  assert.ok(!plan.some((p) => data.family[p.name] === "MAGIKARP"))
  assert.ok(plan.some((p) => p.name === "CHARIZARD")) // Çok oynanan temel form son evrimi engellemez.
  assert.ok(plan.some((p) => p.name === "GALLADE"))
  assert.ok(!plan.some((p) => p.name === "GARDEVOIR"))
  const front = plan.filter((p) => ["CHARIZARD", "BLASTOISE", "VENUSAUR"].includes(p.name))
  assert.deepEqual(front.map((p) => [p.x, p.y]), [[2, 3], [3, 3], [4, 3]])
  assert.ok(plan.filter((p) => !front.includes(p)).every((p) => p.y <= 2))
  assert.deepEqual(plan.find((p) => p.name === "GALLADE").items, ["A", "B", "C"])
  assert.equal(JSON.stringify({ context, cluster }), snapshot)
  const noMeta = planContract(advisor.compToPlan({ ...context, tierPokemons: {} }, cluster))
  assert.equal(noMeta.length, 8)
  assert.ok(noMeta.every((p) => p.items.length === 0))
})

test("compToPlan: keepPlan mevcut birimleri korur, aileleri yinelemez, boş karelere ekler", () => {
  const keep = [{ ...planned("CHARMANDER", 3, 1, ["OWN_ITEM"]), shiny: true, emotion: "HAPPY" }, planned("LAPRAS", 3, 2)]
  const before = JSON.stringify(keep)
  const result = planContract(advisor.compToPlan(plannerCtx, plannerCluster, { keepPlan: keep }))
  assert.deepEqual(result.slice(0, 2), keep)
  assert.equal(result.length, 4)
  assert.equal(result.filter((p) => (data.family[p.name] ?? p.name) === "CHARMANDER").length, 1)
  assert.equal(JSON.stringify(keep), before)
  result[0].items.push("OTHER")
  assert.equal(JSON.stringify(keep), before)
  const occupiedBack = Array.from({ length: 8 }, (_, x) => planned("LATIOS", x, 2))
  const spill = planContract(advisor.compToPlan(plannerCtx, { pokemons: [{ name: "CHARIZARD", frequency: 1 }] }, { keepPlan: occupiedBack }))
  assert.equal(spill.at(-1).y, 1)
  const full = Array.from({ length: 24 }, (_, i) => planned("LATIOS", i % 8, 1 + Math.floor(i / 8)))
  assert.deepEqual(planContract(advisor.compToPlan(plannerCtx, plannerCluster, { keepPlan: full })), full)
  assert.deepEqual(advisor.compToPlan(plannerCtx, plannerCluster, { keepPlan: [planned("CHARMANDER", 8)] }), [])
  assert.deepEqual(advisor.compToPlan(plannerCtx, plannerCluster, { keepPlan: [planned("CHARMANDER"), planned("SQUIRTLE")] }), [])
})

test("planlayıcı: eksik veri ve boş/bozuk girdiler hata üretmez, eski API sabit kalır", () => {
  for (const context of [null, undefined, {}, { data: {} }]) {
    assert.deepEqual(advisor.planFit(context, []), { best: [], synergies: [], missing: [] })
    assert.deepEqual(advisor.planRecommendations(context, []), [])
    assert.deepEqual(advisor.planItems(context, []), [])
    assert.deepEqual(advisor.compToPlan(context, plannerCluster), [])
  }
  for (const plan of [null, undefined, {}, "invalid"]) {
    assert.deepEqual(advisor.planFit(plannerCtx, plan), { best: [], synergies: [], missing: [] })
    assert.deepEqual(advisor.planRecommendations(plannerCtx, plan), [])
    assert.deepEqual(advisor.planItems(plannerCtx, plan), [])
  }
  const noMeta = { data, clusters: null, tierPokemons: null }
  assert.deepEqual(advisor.planFit(noMeta, []), { best: [], synergies: [], missing: [] })
  assert.deepEqual(advisor.planRecommendations(noMeta, []), [])
  assert.deepEqual(advisor.planItems(noMeta, [planned("CHARMANDER")]), [])
  assert.deepEqual(advisor.compToPlan(noMeta, null), [])
  assert.deepEqual(advisor.compToPlan(noMeta, { pokemons: [null, { name: "UNKNOWN", frequency: 1 }] }), [])
  assert.deepEqual(advisor.planFit({ ...plannerCtx, clusters: [null, {}, { count: 100, pokemons: [null] }] }, [null]),
    { best: [], synergies: [], missing: [] })
  const { familyOf: oldFamily, ...oldAnalysis } = before
  const { familyOf: newFamily, ...newAnalysis } = advisor.analyze(ctx, legacySnap)
  assert.deepEqual(newAnalysis, oldAnalysis)
  assert.equal(newFamily("CHARIZARD"), oldFamily("CHARIZARD"))
  assert.deepEqual(advisor.summarize(ctx, legacySnap), summary)
})

console.log("advice.test.mjs: seçim, dükkan, eski API ve snapshot testleri geçti")
