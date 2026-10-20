import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../extension/page/game-hook.js", import.meta.url), "utf8")
const copy = (value) => JSON.parse(JSON.stringify(value))
const unit = (overrides = {}) => ({ name: "PIKACHU", x: 0, y: 1, items: [], ...overrides })
const NOW = 1_800_000_000_000
const TTL = 30 * 24 * 60 * 60 * 1000

function harness({ raw = null, pathname = "/lobby" } = {}) {
  const messages = []
  const events = []
  const listeners = new Map()
  const timers = []
  const stored = new Map(raw === null ? [] : [["team_planner", raw]])
  const writes = []
  const dom = { modal: null, root: null }
  const localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value])
      stored.set(key, value)
    }
  }
  const window = {
    localStorage,
    postMessage(message, origin) {
      assert.equal(origin, "https://pokemon-auto-chess.com")
      messages.push(copy(message))
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(callback)
    },
    dispatchEvent(event) {
      events.push(event)
      for (const callback of listeners.get(event.type) ?? []) callback(event)
    }
  }
  const context = vm.createContext({
    window,
    document: {
      body: { firstElementChild: null },
      getElementById: (id) => id === "root" ? dom.root : null,
      querySelector(selector) {
        assert.equal(selector, "dialog.modal.team-builder-modal[open]")
        return dom.modal
      }
    },
    location: { pathname, origin: "https://pokemon-auto-chess.com" },
    console,
    setInterval(callback, ms) { timers.push({ callback, ms }) },
    StorageEvent: class {
      constructor(type, { key, newValue }) {
        this.type = type
        this.key = key
        this.newValue = String(newValue)
      }
    }
  })
  vm.runInContext(`Date.now = () => ${NOW}`, context)
  // Saf yardımcıları yalnız test ortamında aç; üretim dosyasına global API ekleme.
  vm.runInContext(source.replace(/\}\)\(\)\s*$/, "globalThis.helpers = { isPlannerBoard, plannerStorageValue };\n})()"), context)
  return {
    context, window, dom, stored, writes, events, messages,
    helpers: context.helpers,
    tick(ms = 250) { for (const timer of timers) if (timer.ms === ms) timer.callback() },
    send(data, sender = window) {
      for (const callback of listeners.get("message") ?? []) callback({ source: sender, data })
    },
    of(type) { return messages.filter((m) => m.type === `pac-yardimci:${type}`) }
  }
}

function modal(updateBoard) {
  const box = { x: 12, y: 24, width: 800, height: 600 }
  const el = (x, y, width, height) => ({ getBoundingClientRect: () => ({ x, y, width, height }) })
  const builder = {}
  if (updateBoard) builder.__reactFiber$test = {
    memoizedProps: {},
    return: { memoizedProps: {}, return: { memoizedProps: { updateBoard } } }
  }
  const children = {
    "#team-builder": builder,
    ".actions": el(20, 30, 100, 40),
    "#pokemon-picker": el(400, 50, 300, 400),
    "#team-editor": el(20, 100, 350, 240),
    ":scope > header": el(12, 24, 800, 50)
  }
  return { box, getBoundingClientRect: () => box, querySelector: (selector) => children[selector] ?? null }
}

test("dizilim doğrulaması sınırları ve isteğe bağlı alanları kabul eder", () => {
  const { isPlannerBoard } = harness().helpers
  assert.equal(isPlannerBoard([]), true)
  assert.equal(isPlannerBoard([unit({ x: 7, y: 3, items: ["A", "B", "C"], emotion: "HAPPY", shiny: true })]), true)
  assert.equal(isPlannerBoard(Array.from({ length: 24 }, (_, i) => unit({ x: i % 8, y: 1 + Math.floor(i / 8) }))), true)
})

test("dizilim doğrulaması bozuk girdileri ve seyrek dizileri reddeder", () => {
  const { isPlannerBoard } = harness().helpers
  const invalid = [
    null, {}, "[]", new Array(1), Array.from({ length: 25 }, () => unit()), [null], ["PIKACHU"],
    [unit({ name: 1 })], [unit({ name: undefined })],
    ...[-1, 8, 1.5, "1", NaN, Infinity, undefined].map((x) => [unit({ x })]),
    ...[0, 4, 1.5, "1", NaN, Infinity, undefined].map((y) => [unit({ y })]),
    ...[undefined, null, "A", [1], ["A", null], new Array(1), ["A", "B", "C", "D"]].map((items) => [unit({ items })])
  ]
  for (const board of invalid) assert.equal(isPlannerBoard(board), false)
})

test("storage biçimi mevcut süreyi korur, yoksa otuz gün ekler", () => {
  const { plannerStorageValue } = harness().helpers
  const board = [unit({ emotion: "HAPPY", shiny: true })]
  for (const expirationDate of [0, NOW - 1, NOW + TTL]) {
    assert.deepEqual(copy(plannerStorageValue(board, { expirationDate }, NOW)), { expirationDate, value: board })
  }
  for (const previous of [null, {}, { expirationDate: null }]) {
    assert.deepEqual(copy(plannerStorageValue(board, previous, NOW)), { expirationDate: NOW + TTL, value: board })
  }
})

test("planlayıcı açılma, kapanma, geometri ve storage değişikliklerini bildirir", () => {
  const board = [unit({ emotion: "HAPPY", shiny: true })]
  const h = harness({ raw: JSON.stringify({ expirationDate: NOW + TTL, value: board }) })
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner, { open: false, board, rects: null })
  h.tick()
  assert.equal(h.of("planner").length, 1)
  h.dom.modal = modal()
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner, { open: true, board, rects: {
    modal: { x: 12, y: 24, w: 800, h: 600 },
    header: { x: 12, y: 24, w: 800, h: 50 },
    actions: { x: 20, y: 30, w: 100, h: 40 },
    picker: { x: 400, y: 50, w: 300, h: 400 },
    board: { x: 20, y: 100, w: 350, h: 240 }
  } })
  h.tick()
  assert.equal(h.of("planner").length, 2)
  // Scroll/resize sonrası değişen DOMRect bir sonraki mevcut döngüde okunur.
  h.dom.modal.box.y = -15
  h.dom.modal.box.width = 700
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner.rects.modal, { x: 12, y: -15, w: 700, h: 600 })
  h.stored.set("team_planner", JSON.stringify({ value: [] }))
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner.board, [])
  h.dom.modal = null
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner, { open: false, board: [], rects: null })
})

test("hello aynı planı tekrar bildirir; yabancı kaynak ve ilgisiz tipler yok sayılır", () => {
  const h = harness()
  h.tick()
  h.send({ type: "pac-yardimci:hello" }, {})
  h.send({ type: "pac-yardimci:planner-set", board: [unit()], requestId: "foreign" }, {})
  h.send({ type: "pac-yardimci:other", board: [unit()] })
  h.tick()
  assert.equal(h.of("planner").length, 1)
  assert.equal(h.of("planner-set-result").length, 0)
  assert.equal(h.writes.length, 0)
  h.send({ type: "pac-yardimci:hello" })
  assert.equal(h.of("planner").length, 1)
  h.tick()
  assert.equal(h.of("planner").length, 2)
})

test("açık planlayıcı React üst fiberindeki updateBoard ile yüklenir", () => {
  const h = harness()
  const calls = []
  const board = [unit({ x: 7, y: 3, items: ["LEFTOVERS"], shiny: true })]
  h.dom.modal = modal((next) => {
    calls.push(copy(next))
    // Gerçek oyunda modalın state değişiminden sonraki effect storage'a yazar.
    h.stored.set("team_planner", JSON.stringify({ expirationDate: NOW + TTL, value: next }))
  })
  h.send({ type: "pac-yardimci:planner-set", board, requestId: "react-1" })
  assert.deepEqual(calls, [board])
  assert.equal(h.writes.length, 0)
  assert.equal(h.events.length, 0)
  assert.deepEqual(h.of("planner-set-result"), [{ type: "pac-yardimci:planner-set-result", requestId: "react-1", ok: true, via: "react" }])
  h.tick()
  assert.deepEqual(h.of("planner").at(-1).planner.board, board)
})

test("kapalı veya fiberi bulunamayan planlayıcı storage ve storage olayıyla yüklenir", () => {
  for (const open of [false, true]) {
    const h = harness({ raw: JSON.stringify({ expirationDate: NOW - 5, value: [unit()] }) })
    if (open) h.dom.modal = modal()
    const board = [unit({ x: 5, y: 2 })]
    h.send({ type: "pac-yardimci:planner-set", board, requestId: 42 })
    assert.deepEqual(JSON.parse(h.stored.get("team_planner")), { expirationDate: NOW - 5, value: board })
    assert.equal(h.writes.length, 1)
    assert.equal(h.events.length, 1)
    assert.deepEqual({ ...h.events[0] }, { type: "storage", key: "team_planner", newValue: String(board) })
    assert.deepEqual(h.of("planner-set-result"), [{ type: "pac-yardimci:planner-set-result", requestId: 42, ok: true, via: "storage", note: "reopen" }])
    h.tick()
    assert.deepEqual(h.of("planner").at(-1).planner.board, board)
  }
})

test("eksik veya bozuk storage güvenle okunur ve yeni süreyle onarılır", () => {
  for (const raw of [null, "{", "null", "{}", '{"value":{}}']) {
    const h = harness({ raw })
    h.tick()
    assert.deepEqual(h.of("planner").at(-1).planner.board, [])
    h.send({ type: "pac-yardimci:planner-set", board: [], requestId: "empty" })
    assert.deepEqual(JSON.parse(h.stored.get("team_planner")), { expirationDate: NOW + TTL, value: [] })
    assert.equal(h.of("planner-set-result").at(-1).ok, true)
  }
})

test("geçersiz istek hiçbir React veya storage değişikliği yapmaz", () => {
  const h = harness()
  h.dom.modal = modal(() => assert.fail("Geçersiz dizilim React'e gönderilmemeli"))
  h.send({ type: "pac-yardimci:planner-set", board: [unit({ y: 0 })], requestId: "invalid" })
  const result = h.of("planner-set-result").at(-1)
  assert.equal(result.requestId, "invalid")
  assert.equal(result.ok, false)
  assert.equal(typeof result.error, "string")
  assert.equal(h.writes.length, 0)
  assert.equal(h.events.length, 0)
})

test("React ve storage hataları başarısız yanıt verir", () => {
  for (const via of ["react", "storage"]) {
    const h = harness()
    const fail = () => { throw new Error("test") }
    if (via === "react") h.dom.modal = modal(fail)
    else h.window.localStorage.setItem = fail
    h.send({ type: "pac-yardimci:planner-set", board: [unit()], requestId: via })
    const result = h.of("planner-set-result").at(-1)
    assert.equal(result.requestId, via)
    assert.equal(result.ok, false)
    assert.equal(result.via, via)
    assert.equal(typeof result.error, "string")
    assert.equal(h.events.length, 0)
    assert.equal(h.writes.length, 0)
  }
})

test("planlayıcı hatası eski game, screen ve health mesajlarını durdurmaz", () => {
  const h = harness()
  h.window.localStorage.getItem = () => { throw new Error("storage kapalı") }
  h.dom.modal = { getBoundingClientRect() { throw new Error("DOM okunamıyor") } }
  h.tick()
  h.tick(1000)
  assert.deepEqual(h.of("screen"), [{ type: "pac-yardimci:screen", screen: null }])
  assert.deepEqual(h.of("game"), [{ type: "pac-yardimci:game", snapshot: null }])
  assert.deepEqual(h.of("health"), [{ type: "pac-yardimci:health", status: "idle", inGame: false }])
  h.send({ type: "pac-yardimci:hello" })
  h.tick(1000)
  assert.equal(h.of("game").length, 2)
  assert.equal(h.of("health").length, 2)
})

test("canlı game ve screen yükleri köprüden önceki kancayla aynıdır", () => {
  const h = harness({ pathname: "/game/test" })
  const state = { network: { uid: "self" }, game: {
    stageLevel: 3, phase: "pick", money: 10, shop: ["PIKACHU"], players: [{
      id: "self", life: 100, alive: true, board: [{ id: "p1", name: "PIKACHU", positionX: 1, positionY: 2,
        stars: 1, items: ["LEFTOVERS"], types: ["ELECTRIC"] }]
    }]
  } }
  h.dom.root = { __reactContainer$test: { memoizedProps: { store: { getState: () => state } } } }
  h.window.PHASER_GAME = {
    canvas: { isConnected: true, width: 800, height: 600,
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }) },
    scale: { width: 800, height: 600 },
    scene: { getScene: () => ({
      cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1, width: 800, height: 600 } },
      board: { player: { id: "self" }, mode: "pick", pokemons: [{
        id: "p1", playerId: "self", pokemon: state.game.players[0].board[0], x: 100, y: 200, width: 72, height: 72
      }] }
    }) }
  }
  h.tick()
  h.tick(1000)
  assert.deepEqual(h.of("screen").at(-1).screen, { mode: "pick", units: [{ name: "PIKACHU", x: 1, y: 2, index: 0,
    rect: { left: 74, top: 184, width: 72, height: 72 } }], items: [] })
  assert.deepEqual(h.of("game").at(-1).snapshot, {
    uid: "self", stage: 3, phase: "pick", money: 10, life: 100, alive: true, maxInterest: 5,
    regionalPokemons: [], additionalPokemons: [],
    board: [{ name: "PIKACHU", x: 1, y: 2, stars: 1, items: ["LEFTOVERS"], types: ["ELECTRIC"] }],
    inventory: null, shop: ["PIKACHU"], choices: [], itemsProposition: [], pokemonsProposition: [],
    synergies: {}, opponent: null, players: 1, taken: { PIKACHU: 1 }, carousel: null
  })
  assert.deepEqual(h.of("health").at(-1), { type: "pac-yardimci:health", status: "ok", inGame: true })
  h.tick()
  h.tick(1000)
  // Konum değişmediyse aynı saniye içinde tekrar yollanmaz (saniyede bir canlılık mesajı)
  assert.equal(h.of("screen").length, 1)
  assert.equal(h.of("game").length, 1)
  assert.equal(h.of("health").length, 2)
})
