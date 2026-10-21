import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { performance } from "node:perf_hooks"
import { loadEvaluation } from "../scripts/eval-advice.mjs"

const { advisor, data, meta } = loadEvaluation()
const player = (id, history = [], extra = {}) => ({ id, name: id, alive: true, life: 100, history, board: [], synergies: {}, ...extra })
const snapshot = (lobby, extra = {}) => ({ uid: "A", phase: 0, stage: 4, lobby, ...extra })
const context = (snap) => advisor.buildContext({ data, meta, snap })
const predict = (snap) => advisor.nextOpponents(context(snap), snap)
const odds = (result) => Object.fromEntries(result.candidates.map((c) => [c.id, c.pct]))

test("eşleşme sayısı: iki kez karşılaşılan B yerine C veya D, düz ve hayalet id ile", () => {
  for (const prefix of ["", "ghost-"]) {
    const snap = snapshot([player("A", [`${prefix}B`, `${prefix}B`]), player("B", ["A", "A"]), player("C"), player("D")])
    // AB+CD maliyeti 4; AC+BD ve AD+BC maliyeti 0, uzaklıkları eşit.
    assert.deepEqual(odds(predict(snap)), { C: 50, D: 50 })
  }
})

test("eşit sayıda toplam uzaklık seçimi belirler", () => {
  const snap = snapshot([
    player("A", ["B", "C", "D"]), player("B", ["A", "D", "C"]),
    player("C", ["D", "A", "B"]), player("D", ["C", "B", "A"])
  ])
  // Üç eşlemenin de count'u 4; uzaklık AB+CD=12, AC+BD=8, AD+BC=4.
  assert.deepEqual(odds(predict(snap)), { B: 100 })
})

test("sayı önceliklidir; uzaklığı büyük tekrarlı eşleme seçilmez", () => {
  const snap = snapshot([player("A", ["B", ...Array(20).fill("pve")]), player("B", ["A", ...Array(20).fill("pve")]), player("C"), player("D")])
  assert.deepEqual(odds(predict(snap)), { C: 50, D: 50 })
})

test("PvE ve oyuncu dışı kayıtlar sayılmaz; findLastIndex bulunamazsa length+1", () => {
  const snap = snapshot([player("A", ["pve", "retired"]), player("B", ["pve"]), player("C"), player("D")])
  // Hiç karşılaşma yok: bütün eşlemelerin uzaklığı 7, her rakip 1/3.
  const result = predict(snap)
  assert.deepEqual(odds(result), { B: 34, C: 33, D: 33 })
  assert.equal(result.candidates.reduce((sum, c) => sum + c.pct, 0), 100)
})

test("üç oyuncu: altı eşit hayaletli kombinasyon ve kırmızı hayaletin gerçek maçı", () => {
  const snap = snapshot([player("A"), player("B"), player("C")])
  // AB+C→A, AB+C→B, AC+B→A, AC+B→C, BC+A→B, BC+A→C.
  // Kendi hayaletimiz başkasıyla oynasa da kendi rakibimiz gerçek eşimizdir.
  assert.deepEqual(odds(predict(snap)), { B: 50, C: 50 })
})

test("hayalet maliyeti tek yönlüdür, simetrik geçmiş eklenmez", () => {
  const snap = snapshot([player("A", ["ghost-B", "B"]), player("B"), player("C")], { uid: "B" })
  // En iyi üç eşleme: AC+B→A, AC+B→C, BC+A→C; count=0, distance=5.
  // B için A bir, C iki kez: %33/%67. B→A'ya A'nın geçmişini eklemek hatalıdır.
  assert.deepEqual(odds(predict(snap)), { C: 67, A: 33 })
})

test("ölü oyuncular eşlenmez ve hayalet kaynağı da olamaz", () => {
  const snap = snapshot([player("A"), player("B"), player("C"), player("D", [], { alive: false })])
  assert.deepEqual(odds(predict(snap)), { B: 50, C: 50 })
  assert.equal(predict({ ...snap, uid: "D" }).kind, "unknown")
})

test("PvE aşamaları hazırlıkta pve, savaşta unknown; eski rakip dikkate alınmaz", () => {
  for (const stage of [1, 2, 3, 9, 14, 19, 24, 28, 32, 36, 40]) {
    const snap = snapshot(undefined, { stage, opponent: { id: "previous" } })
    const result = predict(snap)
    assert.equal(result.kind, "pve")
    assert.equal(result.candidates.length, 0)
    assert.equal(predict({ ...snap, phase: 1 }).kind, "unknown")
  }
})

test("eksik veri, geçersiz lobi ve Double Up tahmin edilmez", () => {
  const valid = snapshot([player("A"), player("B")])
  for (const snap of [null, {}, { ...valid, phase: 1 }, { ...valid, phase: 2 }, { ...valid, stage: undefined },
    { ...valid, lobby: undefined }, { ...valid, lobby: {} }, { ...valid, lobby: [] }, snapshot([player("A")]),
    snapshot([player("A"), player("A")]), snapshot([player("A"), player("B", null)]),
    snapshot([player("A"), player("B", [], { doubleUpTeamId: "team" })]),
    snapshot([player("A"), player("B", [], { doubleUpTeamId: "team" })], { stage: 9 }),
    snapshot([player("A"), player("B", [null])]),
    snapshot(Array.from({ length: 9 }, (_, i) => player(i === 0 ? "A" : String(i))))]) {
    const result = predict(snap)
    assert.equal(result.kind, "unknown")
    assert.equal(result.candidates.length, 0)
  }
  assert.equal(advisor.nextOpponents(null, valid).kind, "unknown")
})

test("aday özeti aktif sinerjileri, sahadaki birimleri ve en güçlü iki birimi verir", () => {
  const p = player("B", [], { name: "Rakip", life: 42, synergies: { ELECTRIC: 4, FIRE: 3, WATER: 2, ROCK: 9, ICE: 1 },
    board: [
      { name: "PIKACHU", stars: 1, y: 0 }, { name: "CHARIZARD", stars: 3, y: 1 },
      { name: "GYARADOS", stars: 2, y: 2 }, { name: "UXIE", stars: 1, y: 3 },
      { name: "DEFAULT", stars: 3, y: 1 }
    ] })
  const snap = snapshot([player("A"), p])
  const ctx = context(snap)
  ctx.thresholds = { ELECTRIC: [2, 4, 6], FIRE: [2, 4, 6], WATER: [2, 4, 6], ROCK: [3, 6, 9], ICE: [2, 4] }
  const c = advisor.nextOpponents(ctx, snap).candidates[0]
  assert.equal(c.id, "B")
  assert.equal(c.name, "Rakip")
  assert.equal(c.pct, 100)
  assert.equal(c.life, 42)
  assert.equal(c.units, 3)
  assert.equal(JSON.stringify(c.synergies), JSON.stringify([["ROCK", 9], ["ELECTRIC", 4], ["FIRE", 3]]))
  assert.equal(c.top.length, 2)
  assert.equal(c.top[0].name, "UXIE")
  assert.equal(c.top[0].stars, 1)
  assert.equal(c.top[1].name, "CHARIZARD")
  assert.ok(c.top.every((u) => u.name !== "PIKACHU" && Object.keys(u).length === 2))
})

test("güç eşitse güvenilir metada daha iyi ortalama sıra önce gelir", () => {
  const snap = snapshot([player("A"), player("B", [], { board: [
    { name: "FIRST", stars: 2, y: 1 }, { name: "SECOND", stars: 2, y: 2 }, { name: "THIRD", stars: 2, y: 3 }
  ] })])
  const ctx = { data: { pokemons: { FIRST: ["RARE"], SECOND: ["RARE"], THIRD: ["RARE"] } }, minGames: 50,
    tierPokemons: { FIRST: [4, 100], SECOND: [2, 100], THIRD: [1, 2] } }
  assert.equal(JSON.stringify(advisor.nextOpponents(ctx, snap).candidates[0].top),
    JSON.stringify([{ name: "SECOND", stars: 2 }, { name: "FIRST", stars: 2 }]))
  ctx.minGames = 0
  assert.equal(advisor.nextOpponents(ctx, snap).candidates[0].top[0].name, "THIRD")
  ctx.tierPokemons = { FIRST: [1, 100], SECOND: [2, 100], THIRD: [3, 100] }
  assert.equal(advisor.nextOpponents(ctx, snap).candidates[0].top[0].name, "FIRST")
})

test("2–8 oyuncuda yüzde toplamı 100, sıralama azalan ve snapshot önbelleği etkin", () => {
  for (let n = 2; n <= 8; n++) {
    const snap = snapshot(Array.from({ length: n }, (_, i) => player(String(i))), { uid: "0" })
    const ctx = context(snap)
    const result = advisor.nextOpponents(ctx, snap)
    assert.equal(result.kind, "pvp")
    assert.equal(result.candidates.length, n - 1)
    assert.equal(result.candidates.reduce((sum, c) => sum + c.pct, 0), 100)
    assert.ok(result.candidates.every((c, i, rows) => c.pct > 0 && (!i || rows[i - 1].pct >= c.pct)))
    assert.equal(advisor.nextOpponents(ctx, snap), result)
  }
})

test("7 ve 8 oyunculu dolu geçmişlerde önbelleksiz tahmin 50 ms altında", () => {
  for (const n of [7, 8]) {
    const lobby = Array.from({ length: n }, (_, i) => player(String(i), Array.from({ length: 40 }, (_, j) =>
      j % 9 === 0 ? "pve" : String((i + j % (n - 1) + 1) % n))))
    let elapsed = Infinity
    for (let i = 0; i < 3 && elapsed >= 50; i++) {
      const snap = snapshot(lobby, { uid: "0" }), ctx = context(snap)
      const start = performance.now()
      const result = advisor.nextOpponents(ctx, snap)
      elapsed = performance.now() - start
      assert.equal(result.candidates.reduce((sum, c) => sum + c.pct, 0), 100)
    }
    assert.ok(elapsed < 50, `${n} oyuncu: ${elapsed.toFixed(2)} ms`)
  }
})

test("gerçek kaydın hazırlık aşaması sonraki savaşla aynı, PvE savaşında rakip yok", () => {
  const recording = JSON.parse(readFileSync(new URL("./fixtures/games/real-20261020-1952.json", import.meta.url), "utf8"))
  const snaps = recording.events.filter((e) => e.type === "game" && e.payload).map((e) => e.payload)
  for (const stage of [9, 14, 19, 24]) {
    const prep = snaps.find((s) => s.stage === stage && s.phase === 0)
    const fight = snaps.find((s) => s.stage === stage && s.phase === 1)
    assert.ok(prep && fight)
    assert.equal(fight.opponent, null)
    assert.equal(predict(prep).kind, "pve")
  }
  assert.ok(snaps.every((s) => !Object.hasOwn(s, "lobby") && !Object.hasOwn(s, "history")))
  assert.doesNotMatch(JSON.stringify(recording), /ghost-/)
})

test("gerçek p1…p7 rakip sırasıyla uyumlu sentetik lobide gerçekleşen rakip mümkündür", () => {
  const recording = JSON.parse(readFileSync(new URL("./fixtures/games/real-20261020-1952.json", import.meta.url), "utf8"))
  const snaps = recording.events.filter((e) => e.type === "game" && e.payload).map((e) => e.payload)
  const firstCycle = snaps.filter((s, i) => s.phase === 1 && s.opponent && s.stage <= 11 &&
    !snaps.slice(0, i).some((p) => p.stage === s.stage && p.phase === 1))
  assert.deepEqual(firstCycle.map((s) => s.opponent.id), ["p1", "p2", "p3", "p4", "p5", "p6", "p7"])
  const ids = ["self", "p1", "p2", "p3", "p4", "p5", "p6", "p7"]
  const lobby = ids.map((id) => player(id, ["pve", "pve", "pve"]))
  // Yedi turluk dairesel tam eşlemeler: diğer yedi oyuncunun gerçek geçmişi kayıtta yoktur.
  let ring = [ids[0], ...ids.slice(1).reverse()]
  for (let round = 0; round < firstCycle.length; round++) {
    const fight = firstCycle[round]
    const prep = snaps.find((s) => s.stage === fight.stage && s.phase === 0)
    const snap = { ...prep, lobby: structuredClone(lobby) }
    const result = predict(snap)
    assert.ok(result.candidates.some((c) => c.id === fight.opponent.id && c.pct > 0), `stage ${fight.stage}`)
    assert.equal(ring[7], fight.opponent.id)
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[7 - i]
      lobby.find((p) => p.id === a).history.push(b)
      lobby.find((p) => p.id === b).history.push(a)
    }
    if (fight.stage === 8) for (const p of lobby) p.history.push("pve")
    ring = [ring[0], ring[7], ...ring.slice(1, 7)]
  }
})
