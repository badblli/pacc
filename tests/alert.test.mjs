import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../extension/content/alert.js", import.meta.url), "utf8")
const flush = () => new Promise((resolve) => setImmediate(resolve))
async function harness({ hidden = true, focused = true, enabled = true, audioState = "running", missingAudio = false, rejectResume = false, alertSound, gameAudio } = {}) {
  const listeners = {}, changes = [], notes = [], gains = [], contexts = []
  let now = 0
  const listen = (type, fn) => (listeners[type] ??= []).push(fn)
  const document = { hidden, title: "Pokémon Auto Chess", hasFocus: () => focused, addEventListener: listen }
  class AudioContext {
    constructor() { this.state = audioState; this.currentTime = 1; contexts.push(this) }
    async resume() { if (rejectResume) throw Error("autoplay"); this.state = audioState }
    createOscillator() {
      return { frequency: { setValueAtTime() {} }, connect() {}, start: (at) => notes.push(at), stop() {} }
    }
    createGain() {
      return { gain: { setValueAtTime: (gain) => gains.push(gain), linearRampToValueAtTime: (gain) => gains.push(gain), exponentialRampToValueAtTime() {} }, connect() {} }
    }
  }
  const window = { addEventListener: listen, PacI18n: { t: () => "Sıra sende" }, ...(missingAudio ? {} : { AudioContext }), ...(gameAudio ? { Audio: gameAudio } : {}) }
  const chrome = { storage: {
    local: { get: async () => ({ settings: { alert: enabled, alertSound } }) },
    onChanged: { addListener: (fn) => changes.push(fn) }
  } }
  const context = vm.createContext({ window, document, chrome, location: { origin: "https://www.pokemon-auto-chess.com" } })
  vm.runInContext(source, context)
  context.now = () => now
  vm.runInContext("Date.now = () => now()", context)
  await flush()
  const fire = async (type, event = {}) => { for (const fn of listeners[type] ?? []) fn(event); await flush() }
  return {
    document, notes, contexts, gains,
    count: () => notes.length / 2,
    advance: (ms) => { now += ms },
    interact: () => fire("pointerdown"),
    async send(snapshot, source = window) { await fire("message", { source, data: { type: "pac-yardimci:game", snapshot } }) },
    async visible(value = true) { document.hidden = !value; await fire("visibilitychange") },
    async focus(value) { focused = value; await fire("focus") },
    async enabled(value) { changes.forEach((fn) => fn({ settings: { newValue: { alert: value } } }, "local")); await flush() }
  }
}
const snap = (patch = {}) => ({ phase: 1, choices: [], carousel: null, stage: 1, ...patch })

test("alert: faz, yeni seçim, carousel ve portal birer iki notalı ses çıkarır", async () => {
  const h = await harness()
  assert.equal(h.contexts.length, 0)
  await h.interact()
  await h.send(snap())
  await h.send(snap({ phase: 0 }))
  assert.equal(h.count(), 1)
  h.advance(3000)
  await h.send(snap({ phase: 0, choices: [{ id: "a" }] }))
  await h.send(snap({ phase: 0, choices: [{ id: "a" }] }))
  assert.equal(h.count(), 2)
  h.advance(3000)
  await h.send(snap({ phase: 0, carousel: { kind: "items" } }))
  await h.send(snap({ phase: 0, carousel: { kind: "items" } }))
  assert.equal(h.count(), 3)
  await h.send(snap({ phase: 0 }))
  h.advance(3000)
  await h.send(snap({ phase: 0, carousel: { kind: "portals" } }))
  assert.equal(h.count(), 4)
  assert.ok(h.gains.every((gain) => gain <= 0.2))
})

test("alert: üç saniye içindeki tetikler birleşir, seçim kaybolup gelince tekrarlanmaz", async () => {
  const h = await harness()
  await h.interact()
  await h.send(snap())
  await h.send(snap({ phase: 0 }))
  h.advance(2999)
  await h.send(snap({ phase: 0, choices: [{ id: "a" }] }))
  h.advance(4000)
  await h.send(snap({ phase: 0 }))
  await h.send(snap({ phase: 0, choices: [{ id: "a" }] }))
  assert.equal(h.count(), 1)
  await h.send(snap({ phase: 0, choices: [{ id: "b" }] }))
  assert.equal(h.count(), 2)
})

test("alert: görünür ve odaktayken, kapalı ayarda ve yabancı mesajda uyarı yok", async () => {
  for (const options of [{ hidden: false }, { enabled: false }]) {
    const h = await harness(options)
    await h.interact()
    await h.send(snap())
    await h.send(snap({ phase: 0, choices: [{ id: "a" }], carousel: { kind: "items" } }))
    assert.equal(h.count(), 0)
    assert.equal(h.document.title, "Pokémon Auto Chess")
  }
  const h = await harness()
  await h.interact()
  await h.send(snap({ choices: [{ id: "a" }] }), {})
  assert.equal(h.count(), 0)
  await h.enabled(false)
  await h.send(snap({ choices: [{ id: "b" }] }))
  assert.equal(h.count(), 0)
  await h.enabled(true)
  await h.send(snap({ choices: [{ id: "c" }] }))
  assert.equal(h.count(), 1)
})

test("alert: başlık geri gelir, oyun yeni başlık yazarsa korunur, odak da izlenir", async () => {
  const h = await harness({ hidden: false, focused: false })
  await h.interact()
  await h.send(snap({ choices: [{ id: "a" }] }))
  assert.equal(h.count(), 1)
  assert.equal(h.document.title, "🔔 Sıra sende")
  await h.focus(true)
  assert.equal(h.document.title, "Pokémon Auto Chess")
  await h.visible(false)
  h.advance(3000)
  await h.send(snap({ choices: [{ id: "b" }] }))
  h.document.title = "New game title"
  await h.visible()
  assert.equal(h.document.title, "New game title")
  await h.visible(false)
  h.advance(3000)
  await h.send(snap({ choices: [{ id: "c" }] }))
  await h.enabled(false)
  assert.equal(h.document.title, "New game title")
  await h.enabled(true)
  h.advance(3000)
  await h.send(snap({ choices: [{ id: "d" }] }))
  h.document.title = "Stage 5"
  h.advance(3000)
  await h.send(snap({ choices: [{ id: "e" }] }))
  await h.visible()
  assert.equal(h.document.title, "Stage 5")
})

test("alert: etkileşim yoksa, AudioContext yoksa veya askıdaysa yalnız başlık çalışır", async () => {
  for (const options of [{}, { missingAudio: true }, { audioState: "suspended" }, { audioState: "suspended", rejectResume: true }]) {
    const h = await harness(options)
    if (Object.keys(options).length) await h.interact()
    await h.send(snap())
    await h.send(snap({ phase: 0 }))
    assert.equal(h.count(), 0)
    assert.equal(h.document.title, "🔔 Sıra sende")
  }
})

test("alert: gerçek maç kaydındaki uyarı sayısı aşama sayısıyla uyumlu", async (t) => {
  const recording = JSON.parse(readFileSync(new URL("./fixtures/games/real-20261020-1952.json", import.meta.url), "utf8"))
  const h = await harness()
  await h.interact()
  let time = 0
  const stages = new Set()
  for (const event of recording.events) {
    h.advance(event.t - time)
    time = event.t
    if (event.type !== "game") continue
    if (event.payload) stages.add(event.payload.stage)
    await h.send(event.payload)
  }
  t.diagnostic(`${stages.size} aşama, ${h.count()} uyarı`)
  // Carousel ve ikinci seçimler kayıtta hazırlıktan 3 saniyeden fazla uzakta.
  // Bu nedenle aynı aşamada ayrı uyarılar da beklenir.
  assert.ok(h.count() >= stages.size * 0.6 && h.count() <= stages.size * 1.5)
  assert.equal(h.count(), 37)
})

test("alert: varsayılan oyunun seviye atlama sesi; çalamazsa ya da çan seçiliyse çan", async () => {
  const played = []
  let fail = false
  class Audio {
    constructor(src) { this.src = src }
    async play() { if (fail) throw Error("NotAllowedError"); played.push(this.src) }
  }
  const h = await harness({ gameAudio: Audio })
  await h.interact()
  await h.send(snap())
  await h.send(snap({ phase: 0 }))
  assert.deepEqual(played, ["https://www.pokemon-auto-chess.com/pokechess/assets/audio/sounds/level_up.mp3"])
  assert.equal(h.count(), 0)
  fail = true
  h.advance(3000)
  await h.send(snap({ phase: 0, choices: [{ id: "x" }] }))
  assert.equal(h.count(), 1)
  const ball = await harness({ gameAudio: Audio, alertSound: "ball_catch" })
  fail = false
  await ball.send(snap())
  await ball.send(snap({ phase: 0 }))
  assert.match(played.at(-1), /ball_catch.ogg$/)
  const chime = await harness({ gameAudio: Audio, alertSound: "chime" })
  await chime.interact()
  await chime.send(snap())
  await chime.send(snap({ phase: 0 }))
  assert.equal(chime.count(), 1)
  assert.equal(played.length, 2)
})
