// Saf öncelik seçimi ve gerçek panel çizicisi; oyun veya ağ bağlantısı yok.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import test from "node:test"
import { loadEvaluation } from "../scripts/eval-advice.mjs"

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const json = path => JSON.parse(read(path))
const nowWindow = {}
vm.runInNewContext(read("extension/content/now.js"), { window: nowWindow })
const actions = args => JSON.parse(JSON.stringify(nowWindow.PacNow.nowActions(args)))
const analysis = {
  craft: [{ item: "CHARCOAL", for: "CHARIZARD" }],
  shop: [{ pkm: "VULPIX", reasons: ["Team fit"] }],
  placement: [{ reason: "Move back" }], economy: { tips: [["good", "Level up"]] }
}
const freeze = value => { Object.freeze(value); Object.values(value).forEach(v => { if (v && typeof v === "object") freeze(v) }); return value }

test("Şimdi yap: seçim, craft, dükkan; en çok üç ve girdiler değişmez", () => {
  const input = freeze({ analysis: structuredClone(analysis), board: { choice: { type: "unique", options: [{ pct: 32, reasons: ["Fits"] }] } }, snap: { money: 60 } })
  assert.deepEqual(actions(input).map(a => a.kind), ["choice", "craft", "shop"])
  assert.equal(actions(input)[0].detail, "Fits")
  assert.deepEqual(actions({ analysis, snap: { money: 60 } }).map(a => a.kind), ["craft", "shop", "placement"])
  assert.deepEqual(actions({}), [])
  assert.deepEqual(actions(), [])
})

test("Şimdi yap: yerleşim ve ekonomi; çipteki ekonomi tekrarlanmaz; item seçimi önce", () => {
  assert.deepEqual(actions({ analysis: { placement: analysis.placement, economy: analysis.economy }, snap: { money: 60 } }).map(a => a.kind), ["placement", "eco"])
  assert.equal(actions({ analysis: { economy: analysis.economy }, snap: { money: 34, life: 80 } }).length, 0)
  assert.equal(actions({ analysis: { economy: analysis.economy }, snap: { money: 34, life: 20 } })[0].kind, "eco")
  assert.equal(actions({ analysis, board: { choice: { kind: "item", options: [] } } })[0].kind, "choice")
})

async function setup(lang = "en") {
  const { advisor, data, meta } = loadEvaluation()
  const window = { PacAdvisor: advisor, PacNow: nowWindow.PacNow }
  const context = vm.createContext({ window, Date, console })
  vm.runInContext(read("extension/content/i18n.js"), context)
  await window.PacI18n.ready
  window.PacI18n.register("en", json("extension/i18n/en.json"))
  window.PacI18n.register("tr", json("extension/i18n/tr.json"))
  await window.PacI18n.setLang(lang)
  window.PacI18n.strict = true
  // DOM kabuğu kurulmadan gerçek çiziciyi ve durum nesnesini test bağlamına aç.
  const source = read("extension/content/panel.js").split("  // ---------- çerçeve ----------")[0]
  vm.runInContext(source + "window.panelTest = { state, viewGame, targetCard, choiceOptions, gameDetails }; })()", context)
  const api = window.panelTest
  const snap = structuredClone(json("tests/fixtures/games/sample-synthetic.json").events.find(e => e.type === "game").payload)
  Object.assign(api.state, { data, meta, text: { item: {}, pkm: {}, synergy: {} }, game: snap, health: { status: "ok" }, healthAt: Date.now() })
  return { ...api, advisor, snap, window }
}

test("Hazırlık: üç adım sınırı, altı kapalı satır, eski içerikler korunur", async () => {
  const h = await setup()
  h.snap.choices = []; h.snap.pokemonsProposition = []; h.snap.itemsProposition = []
  const html = h.viewGame()
  assert.ok((html.match(/<li data-kind=/g) ?? []).length <= 3)
  assert.match(html, /Do now/)
  assert.equal((html.match(/<details class="card sec/g) ?? []).length, 6)
  assert.doesNotMatch(html, /data-sec="[^"]+" open/)
  for (const text of ["Details", "Synergies", "Shop", "Item advice", "Other teams", "Pool and regional", "Opponent board", "interest", "CHARCOAL"])
    assert.ok(html.includes(text), text)
  h.state.open.shop = true
  assert.match(h.viewGame(), /data-sec="shop" open/)
  assert.match(html, /class="eco-chip"/)
  assert.doesNotMatch(html, /data-kind="eco"/)
})

test("Seçim: başlık, en iyi iki seçenek ve kalanlar; rakip özeti açılır", async () => {
  const h = await setup("tr")
  h.snap.choices = [{ id: "pick", type: "unique", pokemons: ["CHARIZARD", "VULPIX", "MAGIKARP", "EEVEE"] }]
  const original = h.advisor.boardAdvice
  h.advisor.boardAdvice = (...args) => ({ ...original(...args), choice: { kind: "pokemon", type: "unique", options: [32, 31, 21, 10].map((pct, index) => ({ index, pct, verdict: index === 0 ? "best" : index === 1 ? "good" : "neutral", reasons: ["Uyum"] })) } })
  h.advisor.nextOpponents = () => ({ kind: "pvp", candidates: [{ name: "Kenji", pct: 67, synergies: [] }, { name: "Mira", pct: 33 }] })
  const html = h.viewGame()
  assert.match(html, /<h3>Eşsiz Pokémon seç<\/h3>/)
  assert.match(html, /<li data-kind="choice">/)
  assert.match(html, /EN İYİ · %32/)
  assert.match(html, /İYİ · %31/)
  assert.match(html, /class="desc choice-rest"/)
  assert.equal((html.match(/class="choice-option /g) ?? []).length, 2)
  assert.match(html, /data-sec="next-opponent">/)
  assert.match(html, /Kenji %67, Mira %33/)
  h.state.open["next-opponent"] = true
  assert.match(h.viewGame(), /data-sec="next-opponent" open/)
  h.snap.choices = [{ id: "item", type: "item", items: ["CHARCOAL", "MAGNET"] }]
  h.advisor.boardAdvice = original
  assert.match(h.viewGame(), /<h3>Item seç<\/h3>/)
})

test("Rakip: eksik fonksiyon ve unknown gizli; pvp güvenli, üç sinerji; pve", async () => {
  const h = await setup()
  h.snap.choices = []; h.snap.pokemonsProposition = []; h.snap.itemsProposition = []
  assert.doesNotMatch(h.viewGame(), /next-opponent/)
  h.advisor.nextOpponents = () => ({ kind: "unknown", candidates: [] })
  assert.doesNotMatch(h.viewGame(), /next-opponent/)
  h.advisor.nextOpponents = (ctx, snap) => {
    assert.equal(snap, h.snap); assert.ok(ctx.data)
    return { kind: "pvp", candidates: [{ name: '<Kenji>', pct: 67, life: 46, units: 8,
      synergies: [["FIRE", 4], ["DRAGON", 3], ["FLYING", 2], ["WATER", 1]], top: [{ name: "DRAGONITE", stars: 2 }, { name: "FLYGON", stars: 2 }] }, { name: "Mira", pct: 33 }] }
  }
  const html = h.viewGame()
  assert.match(html, /Next opponent/); assert.match(html, /&lt;Kenji&gt;/)
  assert.match(html, /Life 46 · 8 units/); assert.match(html, /Dragonite ★★, Flygon ★★/)
  assert.equal((html.match(/class="chip opponent-syn"/g) ?? []).length, 3)
  assert.match(html, /Mira 33%/)
  h.advisor.nextOpponents = () => ({ kind: "pve" })
  assert.match(h.viewGame(), /Next round: wild Pokémon/)
})

test("Hedef dizilim: plan öncelikli, yalnız sahadaki aileler sayılır", async () => {
  const h = await setup()
  h.state.plan = [{ name: "CHARIZARD", y: 1 }, { name: "BLASTOISE", y: 1 }]
  const html = h.viewGame()
  assert.match(html, /1 \/ 2/)
  assert.match(html, /Missing: Blastoise/)
  assert.match(html, /<progress max="2" value="1"/)
  h.state.plan = []
  assert.match(h.viewGame(), /Target team:/)
})

test("Tema yedekleri, Jost, manifest sırası ve izinler; EN/TR eşitliği", () => {
  const css = read("extension/content/panel.css")
  assert.match(css, /font-family: "Jost"/)
  assert.match(css, /all: initial/)
  assert.doesNotMatch(css, /#(?:1b2030|252b3d|3b4360|121723|1b2232|283250|33406a)/i)
  for (const match of css.matchAll(/var\(([^)]+)\)/g)) assert.match(match[1], /^--(?:color-|border-)[^,]+,\s*.+/)
  const manifest = json("extension/manifest.json")
  const scripts = manifest.content_scripts.find(c => c.js.includes("content/panel.js")).js
  assert.ok(scripts.indexOf("content/now.js") < scripts.indexOf("content/panel.js"))
  assert.deepEqual(manifest.permissions, ["storage", "unlimitedStorage", "alarms", "declarativeNetRequest"])
  assert.deepEqual(manifest.host_permissions, ["https://pokemon-auto-chess.com/*"])
  const en = json("extension/i18n/en.json"), tr = json("extension/i18n/tr.json")
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort())
  assert.match(read("tests/replay-harness.html"), /'now','panel'/)
})
