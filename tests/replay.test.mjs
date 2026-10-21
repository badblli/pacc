import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { performance } from "node:perf_hooks"
import { gunzipSync } from "node:zlib"
import { loadEvaluation } from "../scripts/eval-advice.mjs"

const games = new URL("./fixtures/games/", import.meta.url)
const files = existsSync(games) ? readdirSync(games).filter((f) => /\.json(\.gz)?$/.test(f)) : []
if (!files.length) test("replay: kayıt klasörü boş", { skip: true }, () => {})
const { advisor, data, meta } = loadEvaluation()
function readRecording(file) {
  const raw = readFileSync(new URL(file, games))
  return expandRecording(JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")))
}
// Biçim 2: lobi ayrı "lobby" olaylarında (yalnız değişen oyuncular, ara ara tam kopya).
// Oyun durumlarına lobiyi geri ekler; ilk tam kopyadan önceki durumlar lobisiz kalır.
function expandRecording(recording) {
  let players = null, ids = []
  const events = []
  for (const event of recording.events) {
    if (event.type === "lobby") {
      if (event.payload.full) players = new Map()
      if (players) for (const p of event.payload.players) players.set(p.id, p)
      ids = event.payload.ids
      continue
    }
    if (event.type === "game" && event.payload && players && !event.payload.lobby) {
      event.payload.lobby = ids.map((id) => players.get(id)).filter(Boolean)
    }
    events.push(event)
  }
  return { ...recording, events }
}
// Testler paralel koşarken ya da makine meşgulken tek çağrı 50 ms'yi aşabilir (boşta ~3 ms).
// Aşılırsa iki kez daha ölçülür; gerçek yavaşlama üç ölçümde de aşar.
function timed(name, fn) {
  let start = performance.now()
  const result = fn()
  for (let tries = 1; performance.now() - start >= 50; tries++) {
    assert.ok(tries < 3, `${name}: 50 ms sınırı üç ölçümde de aşıldı`)
    start = performance.now()
    fn()
  }
  return result
}
function percentages(value) {
  if (!value || typeof value !== "object") return
  for (const [key, v] of Object.entries(value)) {
    if (["pct", "fit", "winrate"].includes(key) && typeof v === "number") assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${key}: ${v}`)
    percentages(v)
  }
}
for (const file of files) test(`replay: ${file}`, () => {
  const recording = // Büyük kayıtlar sıkıştırılmış (.json.gz) saklanır
  readRecording(file)
  assert.equal(recording.format, 1)
  let plan = [], count = 0
  for (const event of recording.events) {
    assert.ok(Number.isFinite(event.t))
    if (event.type === "planner") plan = event.payload?.board ?? []
    if (event.type !== "game" || !event.payload) continue
    count++
    const snap = event.payload
    const ctx = timed("buildContext", () => advisor.buildContext({ data, meta, settings: {}, snap, plan }))
    const next = timed("nextOpponents", () => advisor.nextOpponents(ctx, snap))
    percentages(next)
    assert.ok(next.candidates.length === 0 || next.candidates.reduce((sum, c) => sum + c.pct, 0) === 100)
    const placement = timed("placementAdvice", () => advisor.placementAdvice(ctx, snap))
    percentages(timed("analyze", () => advisor.analyze(ctx, snap)))
    const board = timed("boardAdvice", () => advisor.boardAdvice(ctx, snap))
    percentages(board)
    assert.ok(placement.length <= 3)
    for (const tip of placement) {
      for (const index of tip.with === undefined ? [tip.index] : [tip.index, tip.with]) {
        assert.ok(Number.isInteger(index) && index >= 0 && index < snap.board.length)
        assert.ok(snap.board[index].y > 0)
      }
      const unit = snap.board[tip.index]
      assert.equal(tip.name, unit.name)
      assert.equal(tip.x, unit.x)
      assert.equal(tip.y, unit.y)
    }
    assert.deepEqual(board.placement, placement)

    const choice = snap.choices?.[0]
    for (const option of board.choice?.options ?? []) {
      // Gerçek oyunda Pokémon seçiminde items boş dizi ([]) gelir; tür motorun verdiği kind'dan okunur
      const n = (board.choice.kind === "item" ? choice?.items : choice?.pokemons)?.length ?? 0
      assert.ok(Number.isInteger(option.index) && option.index >= 0 && option.index < n)
    }
    for (const option of board.shop) assert.ok(Number.isInteger(option.index) && option.index >= 0 && option.index < snap.shop.length)
    for (const craft of board.craft) assert.ok(Number.isInteger(craft.targetIndex) && craft.targetIndex >= 0 && craft.targetIndex < snap.board.length)
    if (snap.carousel) {
      const method = snap.carousel.kind === "items" ? "rankCarousel" : "rankPortals"
      const rows = timed(method, () => advisor[method](ctx, snap, plan))
      percentages(rows)
      for (const row of rows) {
        assert.ok(row.score >= 0 && row.score <= 100)
        assert.ok(snap.carousel.kind === "items" ? snap.carousel.items.some((v) => v.name === row.item)
          : snap.carousel.portals.some((v) => v.id === row.portalId))
      }
    }
    if (plan.length) for (const method of ["planFit", "planRecommendations"]) percentages(timed(method, () => advisor[method](ctx, plan)))
  }
  assert.ok(count > 0, "En az bir oyun durumu sınanmalı")
})

test("yerleşim: gerçek son tahtada Pikachu önde, Uxie arkada doğru kalır", () => {
  const recording = JSON.parse(readFileSync(new URL("real-20261020-1952.json", games), "utf8"))
  const last = recording.events.filter((e) => e.type === "game" && e.payload?.board?.length).at(-1).payload
  // Son durum savaş fazında olsa da hazırlıkta aynı dizilim için öneri çıkmamalı.
  const snap = { ...last, phase: 0 }
  assert.ok(snap.board.some((u) => u.name === "PIKACHU" && u.y === 3))
  assert.ok(snap.board.some((u) => u.name === "UXIE" && u.y === 1))
  const ctx = advisor.buildContext({ data, meta, settings: {}, snap })
  assert.equal(timed("placementAdvice", () => advisor.placementAdvice(ctx, snap)).length, 0)
})

const flush = () => new Promise((resolve) => setImmediate(resolve))
async function recorder(settings = {}, stored) {
  const memory = { settings, ...(stored ? { gameRecording: stored } : {}) }, messages = [], changes = []
  let writes = 0
  // Kaydedici depoya 5 sn'de bir toplu yazar: sahte zamanlayıcı her gönderimden sonra süreyi doldurur
  const timers = []
  const window = { addEventListener: (type, fn) => { if (type === "message") messages.push(fn) } }
  const chrome = { runtime: { getManifest: () => ({ version: "1.1.1" }) }, storage: {
    local: { get: async () => structuredClone(memory), set: async (value) => { writes++; Object.assign(memory, structuredClone(value)) } },
    onChanged: { addListener: (fn) => changes.push(fn) }
  } }
  vm.runInNewContext(readFileSync(new URL("../extension/content/recorder.js", import.meta.url), "utf8"), { window, chrome, TextEncoder, Date,
    setTimeout: (fn) => { timers.push(fn); return timers.length }, clearTimeout() {} })
  await flush()
  const elapse = async () => { while (timers.length) timers.shift()(); await flush() }
  return { memory, writes: () => writes,
    async send(type, payload, source = window) { messages.forEach((fn) => fn({ source, data: { type: `pac-yardimci:${type}`, [type === "game" ? "snapshot" : type]: payload } })); await flush(); await elapse() },
    async change(value) { changes.forEach((fn) => fn(value, "local")); await flush() }
  }
}
test("recorder: varsayılan kapalı, yabancı pencere yok, tekrarlar atlanır, kimlikler anonim", async () => {
  const r = await recorder()
  const snap = { uid: "private-uid", name: "private-self", avatar: "private-url", board: [{ name: "CHARIZARD" }],
    opponent: { id: "private-other", name: "private-name", avatarId: "private-avatar", board: [{ name: "GYARADOS" }] } }
  await r.send("game", snap)
  assert.equal(r.writes(), 0)
  await r.change({ settings: { newValue: { record: true } } })
  await r.send("game", snap, {})
  assert.equal(r.writes(), 0)
  await r.send("game", snap)
  await r.send("screen", { mode: "pick" })
  await r.send("game", snap)
  assert.equal(r.memory.gameRecording.events.length, 2)
  const text = JSON.stringify(r.memory.gameRecording)
  assert.doesNotMatch(text, /private-|avatar/i)
  const payload = r.memory.gameRecording.events[0].payload
  assert.equal(payload.uid, "self")
  assert.equal(payload.opponent.name, "p1")
  assert.equal(payload.opponent.id, "p1")
  assert.equal(payload.board[0].name, "CHARIZARD")
  await r.change({ settings: { newValue: { record: false } } })
  await r.send("game", { ...snap, stage: 13 })
  assert.equal(r.writes(), 2)
  const reload = await recorder({ record: true }, r.memory.gameRecording)
  await reload.send("game", snap)
  assert.equal(reload.writes(), 0)
  await reload.change({ gameRecording: { oldValue: reload.memory.gameRecording } })
  await reload.send("game", snap)
  assert.equal(reload.memory.gameRecording.events.length, 1)
})
test("recorder: lobi, hayalet geçmişi ve kendi kimliği aynı eşlemeyle anonimleşir", async () => {
  const r = await recorder({ record: true })
  const ids = ["private-self", ...Array.from({ length: 7 }, (_, i) => `private-id-${i}`)]
  const lobby = ids.map((id, i) => ({ id, name: `private-name-${i}`, alive: true, life: 100,
    history: [ids[(i + 1) % 8], `ghost-${ids[(i + 1) % 8]}`, ids[0], `ghost-${ids[0]}`, "private-pve"],
    board: [{ name: "PIKACHU", stars: 2, items: ["LEFTOVERS"], x: 0, y: 1, avatar: "private-unit-avatar" }],
    synergies: { ELECTRIC: 2 }, avatar: "private-avatar", doubleUpTeamId: "private-team" }))
  // Anahtar sırası ve lobi sırası eşlemeyi bozmamalı; kendimiz lobinin ortasındayız.
  const snap = { lobby: [...lobby.slice(1, 4), lobby[0], ...lobby.slice(4)],
    opponent: { id: `ghost-${ids[3]}`, name: "private-other", avatarId: "private-avatar" }, uid: ids[0],
    opponentId: ids[3], playerId: ids[0] }
  await r.send("game", snap)
  // Lobi ayrı bir "lobby" olayında saklanır (biçim 2); oyun durumuna geri eklenerek sınanır
  assert.equal(r.memory.gameRecording.format, 2)
  assert.deepEqual(r.memory.gameRecording.events.map((e) => e.type), ["lobby", "game"])
  assert.equal(r.memory.gameRecording.events[1].payload.lobby, undefined)
  const payload = expandRecording(structuredClone(r.memory.gameRecording)).events[0].payload
  const own = payload.lobby.find((p) => p.id === "self")
  assert.equal(own.name, "self")
  assert.equal(payload.uid, "self")
  assert.equal(payload.playerId, "self")
  assert.equal(payload.opponent.id, `ghost-${payload.opponentId}`)
  assert.equal(payload.opponent.name, payload.opponent.id)
  const byRawId = new Map(snap.lobby.map((p, i) => [p.id, payload.lobby[i].id]))
  assert.equal(new Set(payload.lobby.map((p) => p.id)).size, 8)
  assert.deepEqual([...byRawId.values()].filter((id) => id !== "self").sort(), ["p1", "p2", "p3", "p4", "p5", "p6", "p7"])
  for (let i = 0; i < payload.lobby.length; i++) {
    const p = payload.lobby[i], raw = snap.lobby[i]
    const target = byRawId.get(raw.history[0])
    assert.deepEqual(p.history, [target, `ghost-${target}`, "self", "ghost-self", "pve"])
    assert.equal(p.name, p.id)
    assert.equal(p.board[0].name, "PIKACHU")
    assert.equal(p.board[0].items[0], "LEFTOVERS")
  }
  assert.doesNotMatch(JSON.stringify(r.memory.gameRecording), /private-|avatar/i)
  const updated = { ...snap, opponent: { id: ids[5], name: "private-next" } }
  await r.send("game", updated)
  // Lobi değişmediyse yeni lobi olayı yazılmaz; geri kurulan lobi aynıdır
  assert.deepEqual(r.memory.gameRecording.events.map((e) => e.type), ["lobby", "game", "game"])
  const next = expandRecording(structuredClone(r.memory.gameRecording)).events[1].payload
  assert.equal(next.opponent.id, byRawId.get(ids[5]))
  assert.deepEqual(next.lobby, payload.lobby)
  // Tek oyuncu değişince yalnız o oyuncu yazılır
  // Oyun durumu aynıysa yeni oyun olayı yazılmaz, yalnız lobi farkı; sonraki durum farkı alır
  const moved = { ...updated, lobby: updated.lobby.map((p, i) => i === 0 ? { ...p, life: 90 } : p) }
  await r.send("game", moved)
  await r.send("game", { ...moved, opponentId: ids[2] })
  const delta = r.memory.gameRecording.events.at(-2)
  assert.equal(delta.type, "lobby")
  assert.equal(delta.payload.full, false)
  assert.equal(delta.payload.players.length, 1)
  assert.equal(expandRecording(structuredClone(r.memory.gameRecording)).events.at(-1).payload.lobby.find((p) => p.life === 90)?.id, byRawId.get(ids[1]))
})

test("recorder: UTF-8 boyut sınırında en eski olay atılır", async () => {
  const r = await recorder({ record: true })
  for (let i = 0; i < 10; i++) await r.send("screen", { i, padding: "ğ".repeat(500_000) })
  const record = r.memory.gameRecording
  assert.ok(new TextEncoder().encode(JSON.stringify(record)).length <= 8 * 1024 * 1024)
  assert.ok(record.events[0].payload.i > 0)
  assert.equal(record.events.at(-1).payload.i, 9)
})
test("recorder: manifest izinleri değişmedi", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"))
  assert.deepEqual(manifest.permissions, ["storage", "unlimitedStorage", "alarms", "declarativeNetRequest"])
  assert.ok(manifest.content_scripts.some((s) => s.js.includes("content/recorder.js")))
})

test("popup: kayıt anahtarı, Blob indirmesi ve silme gerçek kodla çalışır", async () => {
  const memory = { settings: {}, gameRecording: { format: 1, recordedAt: "2026-10-20T12:34:00Z", extensionVersion: "1.1.1", events: [{ t: 1, type: "game", payload: null }] } }
  const elements = new Map(), listeners = []
  let link, blob, revoked = false
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: "", classList: { toggle() {} }, addEventListener(type, fn) { this[type] = fn } })
    return elements.get(id)
  }
  const chrome = { storage: { local: {
    get: async () => structuredClone(memory),
    set: async (value) => Object.assign(memory, structuredClone(value)),
    remove: async (key) => { delete memory[key] }
  }, onChanged: { addListener: (fn) => listeners.push(fn) } }, runtime: {} }
  const I18n = { lang: "en", ready: Promise.resolve(), t: (key, vars) => `${key}:${vars?.n ?? ""}`,
    resolveLang: () => "en", onChange() {} }
  vm.runInNewContext(readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8"), {
    window: { PacI18n: I18n }, chrome, Blob, Date,
    URL: { createObjectURL: (value) => { blob = value; return "blob:test" }, revokeObjectURL: () => { revoked = true } },
    setTimeout: (fn) => fn(),
    document: { documentElement: {}, querySelectorAll: () => [], getElementById: element, body: { append() {} },
      createElement: () => (link = { click() { this.clicked = true }, remove() {} }) }
  })
  await flush()
  assert.equal(element("record").checked, false)
  assert.equal(element("downloadRecording").textContent, "popup.downloadRecording:1")
  await element("record").change({ target: { checked: true } })
  assert.equal(memory.settings.record, true)
  await element("downloadRecording").click()
  assert.equal(link.clicked, true)
  assert.match(link.download, /^pacc-game-20261020-\d{4}\.json$/)
  assert.equal(blob.type, "application/json")
  assert.deepEqual(JSON.parse(await blob.text()), memory.gameRecording)
  assert.equal(revoked, true)
  await element("clearRecording").click()
  assert.equal(memory.gameRecording, undefined)
  assert.equal(element("downloadRecording").disabled, true)
})

// Gerçek maç: her savaşın rakibi, o aşamanın hazırlığındaki tahminde olmalı.
// Aşama başında oyun bir an önceki savaşın rakibiyle "savaş" fazı yollar; gerçek rakip aşamanın SON savaş anlık görüntüsündedir.
for (const file of files) test(`rakip tahmini: ${file}`, (t) => {
  const games = readRecording(file).events.filter((e) => e.type === "game" && e.payload).map((e) => e.payload)
  if (!games.some((s) => Array.isArray(s.lobby))) return t.skip("kayıtta lobi yok")
  const fights = new Map()
  for (const s of games) if (s.phase === 1) fights.set(s.stage, s.opponent?.id ?? "pve")
  let checked = 0
  for (const [stage, actual] of fights) {
    const pick = games.filter((s) => s.phase === 0 && s.stage === stage).at(-1)
    if (!pick || pick.lobby?.find((p) => p.id === pick.uid)?.alive === false) continue
    const result = advisor.nextOpponents(advisor.buildContext({ data, meta, settings: {}, snap: pick }), pick)
    if (actual === "pve") assert.equal(result.kind, "pve", `aşama ${stage}`)
    else assert.ok(result.candidates.some((c) => c.id === actual && c.pct > 0), `aşama ${stage}: ${actual} tahminde yok`)
    checked++
  }
  assert.ok(checked >= 10, `yalnız ${checked} savaş sınandı`)
})
