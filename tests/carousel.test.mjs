import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const copy = (value) => JSON.parse(JSON.stringify(value))
const sandbox = vm.createContext({ window: {} })
vm.runInContext(read("extension/content/advisor.js"), sandbox)
const advisor = sandbox.window.PacAdvisor
const pokemon = (types, regional = false) => ["RARE", 1, types, false, regional, 3, true]
const ctx = {
  data: {
    family: { REG_FIRE_EVOLVED: "REG_FIRE" },
    pokemons: {
      HERO: pokemon(["FIRE"]), WATERMON: pokemon(["WATER"]),
      REG_FIRE: pokemon(["FIRE"], true), REG_FIRE_EVOLVED: ["RARE", 3, ["FIRE"], false, true, 3, true],
      REG_WATER: pokemon(["WATER"], true), REG_FLY: pokemon(["FIRE", "FLYING"], true),
      REG_DRAGON: pokemon(["FIRE", "DRAGON"], true), REG_GHOST: pokemon(["FIRE", "GHOST"], true)
    },
    recipes: { BLADE: ["A", "B"], GUARD: ["C", "D"], WAND: ["E", "F"], RING: ["G", "H"], DOUBLE: ["A", "A"] },
    regions: { Flame: ["FIRE"], Tide: ["WATER"], Blank: [] }
  },
  minGames: 20,
  thresholds: { FIRE: [2, 4], WATER: [2, 4] },
  tierPokemons: { HERO: [3, 100, 2, ["BLADE", "GUARD"]], WATERMON: [4, 100, 1, ["WAND"]], REG_FIRE: [3, 100, 0, []] },
  clusters: [{ id: "fire", count: 100, rank: 3, pokemons: [{ name: "HERO", frequency: 1 }], items: [{ item: "RING" }] }]
}
const unit = (name = "HERO", extra = {}) => ({ name, y: 1, x: 0, stars: 1, items: [], ...extra })
const itemSnap = (items, extra = {}) => ({ board: [unit()], inventory: ["B"],
  carousel: { kind: "items", items: items.map((name, i) => ({ id: String(i), name, taken: false })) }, ...extra })
const portalSnap = (extra = {}) => ({ board: [unit()], carousel: { kind: "portals", portals: [
  { id: "fire", map: "Flame", synergies: ["FIRE"], taken: false },
  { id: "water", map: "Tide", synergies: ["WATER"], taken: false }
] }, ...extra })
const byMap = (rows, map) => rows.find((r) => r.map === map)
const reason = (row, kind) => row.reasons.some((r) => r.kind === kind)
const percent = (n) => assert.ok(Number.isInteger(n) && n >= 0 && n <= 100)

test("carousel: craft > component; alınmışlar puanından bağımsız sona gider, tekrarlar korunur", () => {
  const snap = itemSnap(["C", "A", "BLADE", "A"])
  snap.carousel.items[2].taken = true
  const before = JSON.stringify({ ctx, snap })
  const rows = copy(advisor.rankCarousel(ctx, snap))
  assert.deepEqual(rows.map((r) => r.item), ["A", "A", "C", "BLADE"])
  assert.ok(rows[0].score > rows[2].score)
  assert.ok(rows.at(-1).score > rows[0].score)
  assert.equal(rows.at(-1).taken, true)
  assert.ok(rows[0].reasons.some((r) => r.kind === "craft" && r.pkm === "HERO" && r.item === "B"))
  assert.ok(rows[2].reasons.some((r) => r.kind === "component" && r.item === "GUARD"))
  for (const r of rows) {
    percent(r.score)
    assert.deepEqual(Object.keys(r).sort(), ["item", "reasons", "score", "taken"])
  }
  assert.equal(JSON.stringify({ ctx, snap }), before)
})

test("carousel: eksik envanter craft üretmez, aynı parçalı tarif iki kopya ister", () => {
  assert.equal(reason(advisor.rankCarousel(ctx, itemSnap(["A"], { inventory: null }))[0], "craft"), false)
  const double = { ...ctx, tierPokemons: { HERO: [3, 100, 1, ["DOUBLE"]] } }
  assert.equal(reason(advisor.rankCarousel(double, itemSnap(["A"], { inventory: [] }))[0], "craft"), false)
  assert.equal(reason(advisor.rankCarousel(double, itemSnap(["A"], { inventory: ["A"] }))[0], "craft"), true)
  assert.equal(reason(advisor.rankCarousel(double, itemSnap(["A"], { inventory: ["A", "A"] }))[0], "craft"), false)
})

test("carousel: planın itemleri ve en iyi dizilimin itemleri gerekçe ve puan verir", () => {
  const snap = itemSnap(["E", "G", "UNKNOWN"])
  const plan = [unit("WATERMON")]
  const before = JSON.stringify(plan)
  const rows = copy(advisor.rankCarousel(ctx, snap, plan))
  assert.deepEqual(rows.map((r) => r.item), ["E", "G", "UNKNOWN"])
  assert.ok(rows[0].reasons.some((r) => r.kind === "want" && r.pkm === "WATERMON" && r.item === "WAND"))
  assert.equal(reason(rows[1], "comp"), true)
  assert.equal(rows[2].score, 0)
  assert.equal(JSON.stringify(plan), before)
  const full = [unit("WATERMON", { items: ["X", "Y", "Z"] })]
  assert.equal(reason(advisor.rankCarousel(ctx, snap, full).find((r) => r.item === "E"), "want"), false)
  const low = { ...ctx, tierPokemons: { HERO: [3, 1, 2, ["BLADE"]] }, clusters: [] }
  assert.equal(advisor.rankCarousel(low, itemSnap(["A"]))[0].score, 0)
})

test("portallar: aktif/yakın sinerji, plan ve bölgesel fitScore katkıları", () => {
  const snap = portalSnap()
  const before = JSON.stringify({ ctx, snap })
  const rows = copy(advisor.rankPortals(ctx, snap))
  const fire = byMap(rows, "Flame")
  assert.equal(rows[0].map, "Flame")
  assert.equal(reason(fire, "syn"), true)
  assert.equal(reason(fire, "regional"), true)
  assert.equal(fire.regional.length, 3)
  assert.equal(new Set(fire.regional.map((r) => ctx.data.family[r.pkm] ?? r.pkm)).size, 3)
  assert.ok(fire.regional[0].fit > 0)
  const noRegional = { ...ctx, data: { ...ctx.data, regions: {} } }
  assert.ok(fire.score > byMap(advisor.rankPortals(noRegional, snap), "Flame").score)
  const noTeam = byMap(advisor.rankPortals(ctx, portalSnap({ board: [] })), "Flame")
  assert.ok(fire.score > noTeam.score)
  const planned = advisor.rankPortals(ctx, portalSnap({ board: [] }), [unit("WATERMON")])
  assert.equal(planned[0].map, "Tide")
  assert.equal(reason(planned[0], "plan"), true)
  for (const row of rows) {
    percent(row.score)
    row.regional.forEach((r) => percent(r.fit))
    assert.equal(row.meta, null)
    assert.deepEqual(Object.keys(row).sort(), ["map", "meta", "portalId", "reasons", "regional", "score", "synergies", "taken"])
    assert.ok(row.reasons.every((r) => ["syn", "regional", "meta", "plan", "live"].includes(r.kind)))
  }
  assert.equal(JSON.stringify({ ctx, snap }), before)
})

test("portallar: statik bölge türleri canlı sembol olmasa da uyumu hesaplar", () => {
  const snap = portalSnap()
  snap.carousel.portals[0].synergies = []
  const fire = byMap(advisor.rankPortals(ctx, snap), "Flame")
  assert.equal(reason(fire, "syn"), true)
  assert.deepEqual(copy(fire.synergies), [])
})

test("portallar: düşük ortalama sıra önde; minGames altı ve eksik meta sıfır katkı", () => {
  const context = { ...ctx, data: { ...ctx.data, regions: {} }, regionsMeta: { Flame: [2, 20, []], Tide: [6, 100, []] } }
  const snap = portalSnap({ board: [] })
  const rows = copy(advisor.rankPortals(context, snap))
  assert.equal(rows[0].map, "Flame")
  assert.ok(rows[0].score > rows[1].score)
  assert.deepEqual(rows[0].meta, { rank: 2, count: 20 })
  assert.equal(reason(rows[0], "meta"), true)
  context.regionsMeta.Flame[1] = 19
  const low = byMap(advisor.rankPortals(context, snap), "Flame")
  assert.equal(low.score, 0)
  assert.equal(low.meta, null)
  assert.equal(reason(low, "meta"), false)
  assert.ok(advisor.rankPortals({ ...context, regionsMeta: undefined }, snap).every((p) => p.score === 0))
  snap.carousel.portals[1].taken = true
  assert.equal(advisor.rankPortals(context, snap).at(-1).portalId, "water")
})

test("carousel API'leri eksik veri ve yanlış sahnede boş sonuç verir", () => {
  for (const fn of [advisor.rankCarousel, advisor.rankPortals]) {
    for (const context of [null, {}, { data: {} }]) assert.deepEqual(copy(fn(context, itemSnap(["A"]))), [])
    for (const snap of [null, {}, { carousel: null }, { carousel: { kind: "invalid" } }]) assert.deepEqual(copy(fn(ctx, snap)), [])
    assert.deepEqual(copy(fn(ctx, { carousel: { kind: "items", items: null } })), [])
    assert.deepEqual(copy(fn(ctx, { carousel: { kind: "portals", portals: null } })), [])
  }
  assert.deepEqual(copy(advisor.rankCarousel(ctx, portalSnap())), [])
  assert.deepEqual(copy(advisor.rankPortals(ctx, itemSnap(["A"]))), [])
  const partial = { data: { pokemons: {} } }
  assert.equal(advisor.rankCarousel(partial, itemSnap(["A"], { board: undefined }))[0].score, 0)
  assert.ok(advisor.rankPortals(partial, portalSnap({ board: undefined })).every((p) => p.score === 0))
})

test("static.json en az 50 bölge içerir, town içermez", () => {
  const data = JSON.parse(read("extension/data/static.json"))
  assert.ok(Object.keys(data.regions).length >= 50)
  assert.equal(Object.hasOwn(data.regions, "town"), false)
  assert.deepEqual(data.regions.AmpPlains, ["ELECTRIC", "FIELD", "SOUND"])
  assert.ok(Object.values(data.regions).every((s) => Array.isArray(s) && s.length && s.every((v) => typeof v === "string")))
})

// Gerçek snapshot turunu çalıştır: canlı kök yakalanır, Redux'tan carousel okunmaz.
function hookHarness() {
  const messages = []
  let tick
  const player = { id: "test", board: [], items: [], synergies: {} }
  const redux = { network: { uid: "test" }, game: { players: [player], shop: [], stageLevel: 12, money: 7,
    floatingItems: [{ id: "stale", name: "OLD" }], portals: [{ id: "old", map: "Flame" }] } }
  const context = vm.createContext({
    window: { addEventListener() {}, postMessage: (m) => messages.push(copy(m)) },
    document: { getElementById: () => ({ __reactContainer$test: { memoizedProps: { store: { getState: () => redux } } } }) },
    location: { pathname: "/game/test", origin: "https://example.test" },
    setInterval: (fn, ms) => { if (ms === 1000) tick = fn }, console
  })
  vm.runInContext(read("extension/page/game-hook.js"), context)
  const gs = { players: new Map([["test", player]]), simulations: {}, floatingItems: new Map(), portals: new Map(), symbols: new Map() }
  return { gs, redux, capture() { context.gs = gs; vm.runInContext("new Map().set(0, gs)", context) },
    snapshot() { tick(); return messages.filter((m) => m.type === "pac-yardimci:game").at(-1).snapshot } }
}

test("snapshot: canlı items öncelikli, semboller portalId ile bağlı, boş durum null", () => {
  const h = hookHarness()
  assert.equal(h.snapshot().carousel, null)
  h.capture()
  const baseline = h.snapshot()
  assert.equal(baseline.carousel, null)
  h.gs.floatingItems.set("one", { id: "one", name: "A", avatarId: "" })
  h.gs.floatingItems.set("two", { id: "two", name: "B", avatarId: "avatar" })
  h.gs.portals.set("p1", { id: "p1", map: "Flame", avatarId: "" })
  assert.deepEqual(h.snapshot().carousel, { kind: "items", items: [
    { id: "one", name: "A", taken: false }, { id: "two", name: "B", taken: true }
  ] })
  h.gs.floatingItems.clear()
  h.gs.portals.set("p2", { id: "p2", map: "Tide", avatarId: "avatar" })
  const schema = (values) => ({ forEach: (fn) => values.forEach(fn) })
  h.gs.symbols = schema([{ portalId: "p1", synergy: "FIRE" }, { portalId: "p1", synergy: "DRAGON" },
    { portalId: "other", synergy: "WATER" }])
  const current = h.snapshot()
  assert.deepEqual(current.carousel, { kind: "portals", portals: [
    { id: "p1", map: "Flame", synergies: ["FIRE", "DRAGON"], taken: false },
    { id: "p2", map: "Tide", synergies: [], taken: true }
  ] })
  // Yeni alan dışındaki mevcut değerler bu sahne geçişinde değişmemeli.
  const { carousel: beforeCarousel, ...before } = baseline
  const { carousel: afterCarousel, ...after } = current
  assert.deepEqual(after, before)
  h.gs.portals.clear()
  assert.equal(h.snapshot().carousel, null)
})

// Ağ yerine sahte fetch/storage kullanarak gerçek refresh ve elle yenileme dallarını doğrula.
function backgroundHarness(meta) {
  const calls = []
  const state = { meta }
  const noopEvent = { addListener() {} }
  const responses = {
    "/meta/metadata": [{ created_at: "report-1", time_limit: 100, count: 500 }],
    "/types-trigger": { FIRE: [2, 4] }, "/meta-v2": [], "/meta/pokemons": [], "/meta/items": [],
    "/meta/regions": [{ name: "Flame", rank: 3.2, count: 100, elo: 1200, pokemons: ["A", "B", "C"] }]
  }
  const context = vm.createContext({
    chrome: { runtime: { onInstalled: noopEvent, onStartup: noopEvent, onMessage: noopEvent },
      storage: { local: { get: async () => state, set: async (data) => Object.assign(state, data) }, onChanged: noopEvent },
      alarms: { onAlarm: noopEvent }, commands: { onCommand: noopEvent } }, console,
    fetch: async (url) => { const path = new URL(url).pathname; calls.push(path); return { ok: true, json: async () => copy(responses[path]) } }
  })
  vm.runInContext(read("extension/background.js"), context)
  return { calls, state, refresh: (manual = false) => vm.runInContext(`refresh({manual: ${manual}})`, context) }
}

test("background: format 3 ve compact regions; aynı rapor/manual büyük dosya indirmez", async () => {
  const h = backgroundHarness()
  assert.equal(await h.refresh(), true)
  assert.equal(h.state.meta.format, 3)
  assert.deepEqual(copy(h.state.meta.regions), { Flame: [3.2, 100, ["A", "B", "C"]] })
  assert.equal(h.calls.filter((p) => p === "/meta/regions").length, 1)
  h.calls.length = 0
  assert.equal(await h.refresh(true), false)
  assert.deepEqual(h.calls, [])
  h.state.meta.checkedAt = 0
  assert.equal(await h.refresh(true), false)
  assert.deepEqual(h.calls, ["/meta/metadata", "/types-trigger"])
  h.calls.length = 0
  assert.equal(await h.refresh(), false)
  assert.deepEqual(h.calls, ["/meta/metadata", "/types-trigger"])
  h.state.meta.createdAt = "old-report"
  h.state.meta.checkedAt = 0
  h.calls.length = 0
  assert.equal(await h.refresh(true), true)
  assert.equal(h.calls.filter((p) => p === "/meta/regions").length, 1)
})

test("background: eski format aynı raporda bir kez yeni biçime geçirilir", async () => {
  const h = backgroundHarness({ format: 2, createdAt: "report-1", checkedAt: Date.now() })
  assert.equal(await h.refresh(true), true)
  assert.equal(h.state.meta.format, 3)
  assert.equal(h.calls.filter((p) => p === "/meta/regions").length, 1)
  h.calls.length = 0
  assert.equal(await h.refresh(true), false)
  assert.deepEqual(h.calls, [])
})


test("carousel: plansızken anlık takım taşıyıcısı belirleyici; sapılan planın katkısı azalır", () => {
  const rows = advisor.rankCarousel(ctx, itemSnap(["BLADE", "WAND"]))
  assert.equal(rows[0].item, "BLADE")
  assert.ok(rows[0].reasons.some((r) => r.pkm === "HERO"))
  const water = advisor.rankCarousel(ctx, itemSnap(["BLADE", "WAND"], { board: [unit("WATERMON")] }))
  assert.equal(water[0].item, "WAND")
  const plan = [unit("WATERMON")]
  const early = advisor.rankCarousel(ctx, itemSnap(["WAND"]), plan)[0]
  const deviated = advisor.rankCarousel(ctx, itemSnap(["WAND"], { board: [unit(), unit(), unit()] }), plan)[0]
  assert.ok(early.score > deviated.score)
  assert.equal(reason(early, "plan"), true)
  assert.equal(reason(deviated, "live"), true)
})

test("portallar: plan uyumu değişince canlı sinerjiye döner; ağırlık override etkili", () => {
  const plan = [unit("WATERMON")]
  const early = advisor.rankPortals(ctx, portalSnap({ board: [] }), plan)
  assert.equal(early[0].map, "Tide")
  const deviate = portalSnap({ board: [unit(), unit(), unit()] })
  const rows = advisor.rankPortals(ctx, deviate, plan)
  assert.equal(rows[0].map, "Flame")
  assert.ok(byMap(early, "Tide").score > byMap(rows, "Tide").score)
  assert.ok(reason(rows[0], "live"))
  const noRegional = { ...ctx, data: { ...ctx.data, regions: {} } }
  const base = advisor.rankPortals(noRegional, portalSnap())[0]
  const tuned = advisor.rankPortals({ ...noRegional, weights: { PORTAL_NEAR_BONUS: 0 } }, portalSnap())[0]
  assert.ok(base.score > tuned.score)
})

// Yeni sürüm denetimi: sahte GitHub yanıtıyla rozet ve bağlantı denetimi
test("background: yeni sürüm rozeti ve yalnız kendi depomuzun bağlantısı", async () => {
  const state = { settings: {} }, badges = []
  const noopEvent = { addListener() {} }
  let release = { tag_name: "v9.0.0", html_url: "https://github.com/badblli/pacc/releases/tag/v9.0.0" }, fetched = 0
  const context = vm.createContext({
    chrome: { runtime: { onInstalled: noopEvent, onStartup: noopEvent, onMessage: noopEvent, getManifest: () => ({ version: "1.5.0" }) },
      storage: { local: { get: async () => state, set: async (data) => Object.assign(state, data) }, onChanged: noopEvent },
      alarms: { onAlarm: noopEvent }, commands: { onCommand: noopEvent }, i18n: { getMessage: () => "NEW", getUILanguage: () => "en" },
      action: { setBadgeText: async ({ text }) => badges.push(text), setBadgeBackgroundColor: async () => {} } }, console,
    fetch: async () => { fetched++; return { ok: true, json: async () => copy(release) } }
  })
  vm.runInContext(read("extension/background.js"), context)
  const check = (force = false) => vm.runInContext(`checkUpdate({ force: ${force} })`, context)
  assert.equal(await check(), true)
  assert.equal(badges.at(-1), "NEW")
  assert.equal(state.update.version, "9.0.0")
  assert.equal(await check(), true)
  assert.equal(fetched, 1, "12 saat içinde yeniden sorulmaz")
  release = { tag_name: "v1.5.0", html_url: "https://evil.example/x" }
  assert.equal(await check(true), false)
  assert.equal(badges.at(-1), "")
  assert.equal(state.update.url, "https://github.com/badblli/pacc/releases/latest")
  release = { tag_name: "latest-build" }
  await assert.rejects(check(true))
  state.settings = { updateCheck: false }
  state.update = { version: "9.9.9", url: "https://github.com/badblli/pacc/releases/latest", checkedAt: 0 }
  assert.equal(await check(), false)
  assert.equal(fetched, 3, "kapalıyken sorulmaz")
})
