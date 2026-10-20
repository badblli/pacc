import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { createQuestions, evaluate, loadEvaluation, parseArgs, rankedChoices, runEvaluation, searchWeights } from "../scripts/eval-advice.mjs"

const environment = loadEvaluation()
const options = { seed: 1, limit: 120, tier: "LOVE_BALL" }
const questions = createQuestions(environment, options)
const result = evaluate(environment, questions, options)
const root = fileURLToPath(new URL("../", import.meta.url))
const cli = (...args) => execFileSync(process.execPath, ["scripts/eval-advice.mjs", ...args], { cwd: root, encoding: "utf8" })

test("eval: 120 gerçek takımda bütün görevler rastgele seçimden belirgin iyi", () => {
  // Grid ile ayarlanmış ağırlıklar (d8), seed=1, Love Ball, minGames=50, 120 takım:
  // T1=.9167, T2=.6000, T3(k3)=.4083, T3(k5)=.6500, T4=.3000 (ayardan önce:
  // .8583/.5500/.3917/.5667/.2667). Eşikler 4–5 puan tolerans bırakır ve kazancı korur.
  const floors = { T1: 0.87, T2: 0.55, T3_k3: 0.37, T3_k5: 0.60, T4: 0.26 }
  for (const [key, floor] of Object.entries(floors)) {
    const task = result.tasks[key]
    const actual = task.top1 ?? task.recallAt3
    assert.equal(task.n, 120, `${key}: sessizce soru atlanmamalı`)
    assert.equal(task.skipped, 0)
    assert.ok(actual >= floor, `${key}: ${actual} < ${floor}`)
    assert.ok(actual > task.random + 0.10, `${key}: rastgele seçime fark yetersiz`)
  }
  assert.ok(result.tasks.T1.mrr >= 0.92)
  assert.ok(result.tasks.T1.mrr > result.tasks.T1.randomMrr + 0.20)
  assert.ok(result.tasks.T2.carrier.n <= 120)
  if (!result.tasks.T2.carrier.n) assert.equal(result.tasks.T2.carrier.accuracy, null)
})

test("eval: tüm 768 takımın soruları tek eksiltme ve farklı seçenek sözleşmesini korur", () => {
  const all = createQuestions(environment, { seed: 1 })
  const { data, meta } = environment
  const family = (name) => data.family[name] ?? name
  assert.equal(all.length, 768)
  assert.equal(new Set(all.map((q) => q.id)).size, 768)
  for (const q of all) {
    const source = meta.clusters.find((c) => c.id === q.clusterId).topTeams[Number(q.id.split(":").at(-1))]
    assert.equal(q.unknownUnits, 0)
    assert.ok(q.t1)
    assert.equal(q.t1.snap.board.length, source.pokemons.length - 1)
    assert.equal(q.t1.snap.choices[0].type, "addPick")
    const ordinary = source.pokemons.some((p) => !["UNIQUE", "LEGENDARY"].includes(data.pokemons[p.name][0]))
    if (ordinary) assert.ok(!["UNIQUE", "LEGENDARY"].includes(data.pokemons[q.t1.answer][0]))
    for (const distractor of q.t1.options.filter((name) => name !== q.t1.answer)) {
      assert.equal(data.pokemons[distractor][0], data.pokemons[q.t1.answer][0])
      assert.ok(q.t1.snap.board.every((p) => family(p.name) !== family(distractor)))
    }
    for (const [key, count] of [["t1", 3], ["t2", 3], ["t4", 8]].filter(([key]) => q[key])) {
      assert.equal(new Set(q[key].options).size, count)
      assert.ok(q[key].options.includes(q[key].answer))
    }
    if (q.t2) {
      assert.ok(q.t2.options.filter((it) => it !== q.t2.answer).every((it) => data.recipes[it]))
      assert.ok(q.t4.options.filter((it) => it !== q.t4.answer).every((it) => data.recipes[it] || data.components.includes(it)))
    } else assert.ok(source.pokemons.every((p) => !p.items.length))
    for (const task of [q.t2, q.t4].filter(Boolean)) {
      assert.equal(task.snap.board.reduce((n, p) => n + p.items.length, 0),
        source.pokemons.reduce((n, p) => n + p.items.length, 0) - 1)
      task.snap.board.forEach((p, i) => {
        assert.equal(p.x, i % 8)
        assert.equal(p.y, 3 - Math.floor(i / 8))
      })
    }
    for (const t3 of q.t3) assert.deepEqual(t3.snap.board.map((p) => p.name), source.pokemons.slice(0, t3.k).map((p) => p.name))
  }
  const positions = new Set(all.map((q) => q.t1.options.indexOf(q.t1.answer)))
  assert.equal(positions.size, 3)
})

test("eval: aynı tohum aynı soruları üretir, motor fixture ve soruları değiştirmez", () => {
  assert.deepEqual(createQuestions(environment, options), questions)
  assert.notDeepEqual(createQuestions(environment, { ...options, seed: 2 }), questions)
  const before = JSON.stringify({ data: environment.data, meta: environment.meta, questions })
  assert.deepEqual(evaluate(environment, questions, options), result)
  assert.equal(JSON.stringify({ data: environment.data, meta: environment.meta, questions }), before)
})

test("eval: rozet seçimi, yuvarlanmış pct ve eski score farklı olduğunda korunur", () => {
  assert.deepEqual(rankedChoices([
    { index: 0, pct: 80, score: 99, verdict: "good" },
    { index: 1, pct: 80, score: 1, verdict: "best" },
    { index: 2, pct: 90, score: 100, verdict: "neutral" }
  ]).map((r) => r.index), [1, 2, 0])
})

test("eval CLI: JSON belirlenimci, seed/tier/auto ve tablo çalışır", () => {
  const first = cli("--json", "--limit", "12", "--seed", "17", "--tier", "LOVE_BALL")
  assert.equal(cli("--json", "--limit", "12", "--seed", "17", "--tier", "LOVE_BALL"), first)
  const parsed = JSON.parse(first)
  assert.equal(parsed.seed, 17)
  assert.equal(parsed.baseline.teams, 12)
  assert.equal(JSON.parse(cli("--json", "--limit", "12", "--tier", "MASTER_BALL")).tier, "MASTER_BALL")
  assert.equal(JSON.parse(cli("--json", "--limit", "12", "--tier", "auto")).tier, "LOVE_BALL")
  assert.match(cli("--limit", "12"), /T3_k5/)
  assert.match(cli("--help"), /--grid/)
  assert.throws(() => runEvaluation({ tier: "BOGUS" }, environment), /tier/)
  for (const args of [["--seed"], ["--seed", "nan"], ["--seed", "-1"], ["--limit", "0"], ["--wat"]]) {
    assert.throws(() => parseArgs(args))
  }
  const failure = spawnSync(process.execPath, ["scripts/eval-advice.mjs", "--tier", "BOGUS"], { cwd: root, encoding: "utf8" })
  assert.equal(failure.status, 1)
  assert.match(failure.stderr, /Bilinmeyen tier/)
})

test("eval grid: WEIGHTS yokken açıkça atlanır ve JSON çıktısı bozulmaz", () => {
  if (environment.advisor.WEIGHTS) return
  const report = JSON.parse(cli("--grid", "--json", "--limit", "12"))
  assert.equal(report.grid.status, "skipped")
  assert.match(report.grid.reason, /WEIGHTS/)
})

test("eval grid: üç tur eğitimde arar, doğrulama ayrıdır ve ağırlıkları ctx ile iletir", () => {
  // Küçük yapay motor yalnız arama algoritmasını sınar; kalite testi gerçek motordadır.
  const meta = { clusters: [{ id: "own", count: 100, pokemons: [{ frequency: 1 }] }],
    pokemons: { LOVE_BALL: {} }, items: { LOVE_BALL: {} } }
  const seen = []
  const advisor = {
    WEIGHTS: Object.freeze({ signal: 1 }),
    boardAdvice(ctx) {
      seen.push(ctx.weights?.signal)
      const correct = (ctx.weights?.signal ?? 1) >= 1.5
      return { choice: { options: [0, 1].map((index) => ({ index, pct: Number(correct === (index === 0)),
        holder: { name: "HERO" } })) } }
    },
    analyze(ctx) { return { comps: (ctx.weights?.signal ?? 1) >= 1.5 ? [{ cluster: { id: "own" } }] : [] } },
    rankCarousel(ctx) { return ((ctx.weights?.signal ?? 1) >= 1.5 ? ["A", "B"] : ["B", "A"]).map((item) => ({ item })) }
  }
  const env = { advisor, data: {}, meta }
  const qs = Array.from({ length: 10 }, (_, i) => ({ id: String(i), clusterId: "own",
    t1: { snap: {}, options: ["A", "B"], answer: "A" },
    t2: { snap: {}, options: ["A", "B"], answer: "A", holder: "HERO" },
    t3: [3, 5].map((k) => ({ k, snap: {} })), t4: { snap: {}, options: ["A", "B"], answer: "A" } }))
  const before = JSON.stringify({ meta, qs, defaults: advisor.WEIGHTS })
  const grid = searchWeights(env, qs, { seed: 3 })
  assert.equal(grid.status, "completed")
  assert.equal(grid.evaluations, 15)
  assert.equal(grid.rounds, 3)
  assert.equal(grid.split.trainIds.length, 7)
  assert.equal(grid.split.validationIds.length, 3)
  assert.equal(new Set([...grid.split.trainIds, ...grid.split.validationIds]).size, 10)
  assert.equal(grid.baselineTrain.objective, 0)
  assert.equal(grid.bestTrain.objective, 1)
  assert.equal(grid.bestValidation.objective, 1)
  assert.equal(grid.bestWeights.signal, 1.5)
  assert.ok([0.5, 0.75, 1.25, 1.5, 2].every((w) => seen.includes(w)))
  assert.equal(grid.bestTrain.tasks.T2.carrier.accuracy, 1)
  assert.equal(JSON.stringify({ meta, qs, defaults: advisor.WEIGHTS }), before)
  assert.deepEqual(searchWeights(env, qs, { seed: 3 }), grid)
  // Sadece doğrulama cevapları ters çevrilince seçilen ağırlıklar değişmemeli.
  const validation = new Set(grid.split.validationIds)
  const altered = qs.map((q) => validation.has(q.id) ? { ...q, clusterId: "wrong",
    t1: { ...q.t1, answer: "B" }, t2: { ...q.t2, answer: "B" }, t4: { ...q.t4, answer: "B" } } : q)
  const other = searchWeights(env, altered, { seed: 3 })
  assert.deepEqual(other.bestWeights, grid.bestWeights)
  assert.equal(other.bestValidation.objective, 0)
})
