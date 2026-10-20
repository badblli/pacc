// Gerçek content script, sahte köprü ve yalnızca eklentiye ait gölge ağaç.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { test } from "node:test"

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const catalog = JSON.parse(read("extension/i18n/en.json"))
async function setup() {
  const handlers = {}, rootHandlers = {}, appended = [], calls = [], sent = []
  let storage, language
  const surface = { innerHTML: "", querySelector: () => ({ focus() {} }) }
  const root = { getElementById: () => surface, querySelector: () => ({}), addEventListener: (k, f) => { rootHandlers[k] = f } }
  const host = { attachShadow: () => root, remove() {} }
  const items = [
    { item: "TAKEN", taken: true, score: 100, reasons: [] },
    { item: "LOW", score: 10, reasons: [{ kind: "comp" }] },
    { item: "HIGH", score: 90, reasons: [{ kind: "craft", item: "PART" }] }
  ]
  const portals = [
    { map: "TAKEN_MAP", taken: true, score: 100, synergies: [], regional: [], meta: null },
    { map: "FOREST", score: 80, synergies: ["FIRE"], regional: ["A", "B", "C", "D"].map(pkm => ({ pkm })), meta: { rank: 3.25, count: 200 } }
  ]
  const window = {
    PacAdvisor: Object.fromEntries([["rankCarousel", items], ["rankPortals", portals]].map(([key, result]) => [key, (...args) => { calls.push(args); return result }])),
    PacI18n: { ready: Promise.resolve(), lang: "en", number: String, humanize: String,
      escapeHtml: s => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
      t: (k, vars = {}) => { assert.ok(k in catalog, k); return catalog[k].replace(/\{\{(\w+)\}\}/g, (_, v) => vars[v] ?? "") },
      gameText: async () => ({ item: { HIGH: "Translated item" }, map: { FOREST: "Translated forest" } }), onChange: f => { language = f } },
    addEventListener: (k, f) => { handlers[k] = f }, postMessage: m => sent.push(m)
  }
  vm.runInNewContext(read("extension/content/carousel.js"), {
    window, document: { getElementById: () => null, createElement: () => host, documentElement: { appendChild: h => appended.push(h) } },
    chrome: { runtime: { getURL: p => p }, storage: { local: { get: async () => ({ meta: { regions: { FOREST: [3.25, 200] } } }) }, onChanged: { addListener: f => { storage = f } } } },
    fetch: async () => ({ ok: true, text: async () => "", json: async () => ({ pkmIndex: { A: "0001", B: "0002", C: "0003", D: "0004" } }) }),
    location: { origin: "https://pokemon-auto-chess.com" }
  })
  for (let i = 0; i < 16; i++) await Promise.resolve()
  const message = (data, source = window) => handlers.message({ source, data })
  return { surface, window, items, portals, appended, calls, sent, language,
    game: kind => message({ type: "pac-yardimci:game", snapshot: { carousel: kind ? { kind } : null } }), message,
    settings: value => storage({ settings: { newValue: value } }, "local"),
    click: () => rootHandlers.click({ target: { closest: () => ({}) } }) }
}
test("null, kapalı ayar ve eksik motor kartı gizler; yalnızca kendi hostu eklenir", async () => {
  const h = await setup()
  assert.equal(h.surface.innerHTML, "")
  assert.equal(h.appended.length, 1)
  assert.equal(h.appended[0].id, "pac-carousel")
  h.game("items"); assert.match(h.surface.innerHTML, /class="card"/)
  h.settings({ overlay: false }); assert.equal(h.surface.innerHTML, "")
  h.settings({ overlay: true }); assert.match(h.surface.innerHTML, /class="card"/)
  h.game(null); assert.equal(h.surface.innerHTML, "")
  h.window.PacAdvisor = null; h.game("items"); assert.equal(h.surface.innerHTML, "")
  h.message({ type: "pac-yardimci:game", snapshot: { carousel: { kind: "items" } } }, {})
  assert.equal(h.surface.innerHTML, "")
  assert.deepEqual(h.sent.map(m => m.type), ["pac-yardimci:hello"])
})
test("itemler puana göre, alınmışlar sonda; ilk beş, çeviri ve gerekçe", async () => {
  const h = await setup(); h.game("items")
  let html = h.surface.innerHTML
  assert.ok(html.indexOf("HIGH.png") < html.indexOf("LOW.png"))
  assert.ok(html.indexOf("LOW.png") < html.indexOf("TAKEN.png"))
  assert.match(html, /class="choice taken"/)
  assert.match(html, /Translated item/)
  assert.match(html, /Combines immediately with PART/)
  h.items.push(...Array.from({ length: 6 }, (_, i) => ({ item: `EXTRA_${i}`, score: i })))
  h.game("items")
  assert.equal((h.surface.innerHTML.match(/<li /g) ?? []).length, 5)
  assert.doesNotMatch(h.surface.innerHTML, /TAKEN.png/)
})
test("portal çipleri, üç portre, meta sırası; plan ve regionsMeta bağlamı", async () => {
  const h = await setup()
  const board = [{ name: "CHARIZARD", items: [] }]
  h.message({ type: "pac-yardimci:planner", planner: { board } })
  h.game("portals")
  const html = h.surface.innerHTML
  assert.ok(html.indexOf("Translated forest") < html.indexOf("TAKEN_MAP"))
  assert.match(html, /assets\/types\/FIRE.svg/)
  assert.match(html, /Avg. 3.25/)
  assert.equal((html.match(/class="portrait"/g) ?? []).length, 3)
  assert.doesNotMatch(html, /0004/)
  assert.equal(h.calls.at(-1)[2], board)
  assert.equal(h.calls.at(-1)[0].regionsMeta.FOREST[0], 3.25)
})
test("küçültme sahne ve ayar değişimlerinde korunur; bozuk motor gizlenir", async () => {
  const h = await setup(); h.game("items"); h.click()
  assert.match(h.surface.innerHTML, /aria-expanded="false"/)
  assert.match(h.surface.innerHTML, /id="carousel-choices" hidden/)
  h.game(null); h.game("portals"); h.settings({ overlay: false }); h.settings({ overlay: true })
  assert.match(h.surface.innerHTML, /aria-expanded="false"/)
  h.click(); assert.match(h.surface.innerHTML, /aria-expanded="true"/)
  h.window.PacAdvisor.rankPortals = () => { throw Error() }
  h.game("portals"); assert.equal(h.surface.innerHTML, "")
})
test("carousel anahtarları EN/TR eşit ve puan/host stilleri erişilebilir", () => {
  const tr = JSON.parse(read("extension/i18n/tr.json"))
  const keys = c => Object.keys(c).filter(k => k.startsWith("panel.carousel.")).sort()
  assert.deepEqual(keys(catalog), keys(tr))
  const css = read("extension/content/carousel.css")
  assert.match(css, /top: 72px/)
  assert.match(css, /min-height: 58px/)
  assert.match(css, /\.taken\s*\{\s*opacity: \.48/)
  assert.match(css, /text-decoration: line-through/)
})
