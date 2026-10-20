import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { performance } from "node:perf_hooks"
import { loadEvaluation } from "../scripts/eval-advice.mjs"

const games = new URL("./fixtures/games/", import.meta.url)
const files = existsSync(games) ? readdirSync(games).filter((f) => f.endsWith(".json")) : []
if (!files.length) test("replay: kayıt klasörü boş", { skip: true }, () => {})
const { advisor, data, meta } = loadEvaluation()
function timed(name, fn) {
  const start = performance.now()
  const result = fn()
  assert.ok(performance.now() - start < 50, `${name}: 50 ms sınırı aşıldı`)
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
  const recording = JSON.parse(readFileSync(new URL(file, games), "utf8"))
  assert.equal(recording.format, 1)
  let plan = [], count = 0
  for (const event of recording.events) {
    assert.ok(Number.isFinite(event.t))
    if (event.type === "planner") plan = event.payload?.board ?? []
    if (event.type !== "game" || !event.payload) continue
    count++
    const snap = event.payload
    const ctx = timed("buildContext", () => advisor.buildContext({ data, meta, settings: {}, snap, plan }))
    percentages(timed("analyze", () => advisor.analyze(ctx, snap)))
    const board = timed("boardAdvice", () => advisor.boardAdvice(ctx, snap))
    percentages(board)
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
