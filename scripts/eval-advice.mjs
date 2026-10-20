// Gerçek kazananlardan çevrimdışı sınav üretir; dosyalara veya oyuna yazmaz.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const ratio = (n, d) => d ? n / d : null

export function seededRandom(seed = 1) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let n = Math.imul(state ^ (state >>> 15), state | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(values, random) {
  const out = [...values]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function loadEvaluation() {
  const sandbox = vm.createContext({ window: {} })
  vm.runInContext(read("extension/content/advisor.js"), sandbox, { filename: "advisor.js", timeout: 5000 })
  return {
    advisor: sandbox.window.PacAdvisor,
    data: JSON.parse(read("extension/data/static.json")),
    meta: JSON.parse(read("tests/fixtures/meta.json"))
  }
}

const family = (data, name) => data.family[name] ?? name
function snapshot(data, pokemons) {
  return {
    board: pokemons.map((p, i) => ({ name: p.name, items: [...p.items],
      stars: data.pokemons[p.name]?.[1] ?? 1, x: i % 8, y: 3 - Math.floor(i / 8) })),
    shop: [], inventory: [], synergies: {}, choices: [], itemsProposition: [],
    pokemonsProposition: [], regionalPokemons: [], level: Math.min(10, pokemons.length), money: 0, life: 100
  }
}

// Sorular ağırlıklardan bağımsız bir kez üretilir; arama aynı sınavı tekrar çözer.
export function createQuestions({ data, meta }, { seed = 1, limit } = {}) {
  const random = seededRandom(seed)
  const craftable = Object.keys(data.recipes).sort()
  const carouselPool = [...new Set([...craftable, ...data.components])].sort()
  const pokemonPool = Object.keys(data.pokemons).sort()
  const teams = shuffle(meta.clusters.flatMap((cluster) => cluster.topTeams.map((team, i) =>
    ({ id: `${cluster.id}:${i}`, clusterId: cluster.id, team }))), random).slice(0, limit)
  const pick = (values) => values[Math.floor(random() * values.length)]
  return teams.map(({ id, clusterId, team }) => {
    const valid = team.pokemons.filter((p) => data.pokemons[p.name])
    const ordinary = valid.filter((p) => !["LEGENDARY", "UNIQUE"].includes(data.pokemons[p.name][0]))
    const removed = pick(ordinary.length ? ordinary : valid)
    let t1 = null
    if (removed) {
      const remaining = [...valid]
      remaining.splice(remaining.indexOf(removed), 1)
      const families = new Set(remaining.map((p) => family(data, p.name)))
      const candidates = pokemonPool.filter((name) => data.pokemons[name][0] === data.pokemons[removed.name][0]
        && family(data, name) !== family(data, removed.name) && !families.has(family(data, name)))
      // Aynı ailenin iki evrimi iki ayrı çeldirici sayılmaz.
      const seen = new Set()
      const distractors = shuffle(candidates, random).filter((name) => {
        const fam = family(data, name)
        if (seen.has(fam)) return false
        seen.add(fam)
        return true
      }).slice(0, 2)
      if (distractors.length === 2) {
        const options = shuffle([removed.name, ...distractors], random)
        t1 = { snap: { ...snapshot(data, remaining), choices: [{ type: "addPick", pokemons: options }] },
          options, answer: removed.name }
      }
    }
    let t2 = null
    let t4 = null
    const holder = pick(valid.filter((p) => p.items.length))
    if (holder) {
      const itemIndex = Math.floor(random() * holder.items.length)
      const answer = holder.items[itemIndex]
      const withoutItem = valid.map((p) => p === holder
        ? { ...p, items: p.items.filter((_, i) => i !== itemIndex) } : p)
      const options = shuffle([answer, ...shuffle(craftable.filter((it) => it !== answer), random).slice(0, 2)], random)
      const snap = snapshot(data, withoutItem)
      t2 = { snap: { ...snap, choices: [{ type: "item", items: options }] }, options, answer, holder: holder.name }
      const carouselOptions = shuffle([answer, ...shuffle(carouselPool.filter((it) => it !== answer), random).slice(0, 7)], random)
      t4 = { snap: { ...snap, carousel: { kind: "items", items: carouselOptions.map((name, i) =>
        ({ id: String(i), name, taken: false })) } }, options: carouselOptions, answer }
    }
    return { id, clusterId, t1, t2, t4, t3: [3, 5].map((k) =>
      ({ k, snap: snapshot(data, valid.slice(0, k)) })), unknownUnits: team.pokemons.length - valid.length }
  })
}

function contextFor({ advisor, data, meta }, tier, snap, weights) {
  const settings = { tier, minGames: 50 }
  const ctx = typeof advisor.buildContext === "function"
    ? advisor.buildContext({ data, meta, settings, snap })
    : { data, clusters: meta.clusters, tierPokemons: meta.pokemons[tier], tierItems: meta.items[tier],
      thresholds: meta.thresholds, regionsMeta: meta.regions?.[tier] ?? meta.regions, minGames: settings.minGames }
  return { ...ctx, ...(weights ? { weights } : {}) }
}

// Rozetin seçtiği en iyi seçenek önce gelir. Kalanlarda pct sırası ve karıştırılmış
// giriş sırası korunur; eski score başka bir ölçek olduğu için pct yerine kullanılmaz.
export function rankedChoices(options) {
  return [...options].sort((a, b) => Number(b.verdict === "best") - Number(a.verdict === "best")
    || (b.pct ?? -Infinity) - (a.pct ?? -Infinity) || a.index - b.index)
}

function holderName(option) {
  const holder = option?.holder ?? option?.target
  return typeof holder === "string" ? holder : holder?.name ?? null
}

export function evaluate(environment, questions, { tier = "LOVE_BALL", weights } = {}) {
  const { advisor, meta } = environment
  const scores = Object.fromEntries(["T1", "T2", "T3_k3", "T3_k5", "T4"].map((key) =>
    [key, { n: 0, correct: 0, randomSum: 0, reciprocalSum: 0, randomReciprocalSum: 0 }]))
  const carriers = { n: 0, correct: 0 }
  const record = (key, position, count) => {
    const s = scores[key]
    s.n++
    s.correct += Number(position === 0)
    s.randomSum += 1 / count
    s.reciprocalSum += position < 0 ? 0 : 1 / (position + 1)
    s.randomReciprocalSum += Array.from({ length: count }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b) / count
  }
  for (const question of questions) {
    for (const key of ["T1", "T2"]) {
      const q = question[key.toLowerCase()]
      if (!q) continue
      const ctx = contextFor(environment, tier, q.snap, weights)
      const rows = rankedChoices(advisor.boardAdvice(ctx, q.snap).choice.options)
      const answerIndex = q.options.indexOf(q.answer)
      record(key, rows.findIndex((r) => r.index === answerIndex), q.options.length)
      if (key === "T2") {
        // Item yanlış seçilse de doğru itemin önerilen taşıyıcısını ölçer.
        const holder = holderName(rows.find((r) => r.index === answerIndex))
          ?? (typeof advisor.itemHolderFit === "function" && typeof advisor.teamContext === "function"
            ? holderName(advisor.itemHolderFit(ctx, advisor.teamContext(ctx, q.snap, []), q.answer)) : null)
        if (holder) {
          carriers.n++
          carriers.correct += Number(holder === q.holder)
        }
      }
    }
    for (const q of question.t3) {
      const ctx = contextFor(environment, tier, q.snap, weights)
      const rows = advisor.analyze(ctx, q.snap).comps.slice(0, 3)
      const score = scores[`T3_k${q.k}`]
      score.n++
      score.correct += Number(rows.some((r) => r.cluster.id === question.clusterId))
      const eligible = ctx.clusters.filter((c) => c.count >= ctx.minGames && c.pokemons.some((p) => p.frequency >= 0.25))
      score.randomSum += eligible.some((c) => c.id === question.clusterId) ? Math.min(3, eligible.length) / eligible.length : 0
    }
    if (question.t4) {
      const q = question.t4
      const rows = advisor.rankCarousel(contextFor(environment, tier, q.snap, weights), q.snap)
      record("T4", rows.findIndex((r) => r.item === q.answer), q.options.length)
    }
  }
  const tasks = Object.fromEntries(Object.entries(scores).map(([key, s]) => [key, {
    n: s.n, skipped: questions.length - s.n, correct: s.correct,
    [key.startsWith("T3") ? "recallAt3" : "top1"]: ratio(s.correct, s.n), random: ratio(s.randomSum, s.n),
    ...(key === "T1" ? { mrr: ratio(s.reciprocalSum, s.n), randomMrr: ratio(s.randomReciprocalSum, s.n) } : {})
  }]))
  tasks.T2.carrier = { n: carriers.n, correct: carriers.correct, accuracy: ratio(carriers.correct, carriers.n) }
  const t3 = average([tasks.T3_k3.recallAt3, tasks.T3_k5.recallAt3])
  return { teams: questions.length, tasks,
    objective: average([tasks.T1.top1, tasks.T2.top1, t3, tasks.T4.top1]),
    clusters: meta.clusters.length }
}

// Takım kimlikleri ayrık tutulur. Bu yalnız ağırlık doğrulamasıdır: meta özetleri
// aynı fixture'dandır; bağımsız maçlarda genelleme veya nedensel kalite kanıtı değildir.
export function searchWeights(environment, questions, options = {}) {
  const defaults = environment.advisor.WEIGHTS
  if (!defaults || !Object.keys(defaults).length) return { status: "skipped", reason: "PacAdvisor.WEIGHTS yok; grid atlandı." }
  const keys = Object.keys(defaults)
  if (keys.some((key) => !Number.isFinite(defaults[key]))) throw new Error("WEIGHTS yalnız sonlu sayılar içermeli.")
  if (questions.length < 2) throw new Error("Grid için en az iki takım gerekli.")
  const shuffled = shuffle(questions, seededRandom(options.seed ?? 1))
  const cut = Math.max(1, Math.min(shuffled.length - 1, Math.floor(shuffled.length * 0.7)))
  const train = shuffled.slice(0, cut)
  const validation = shuffled.slice(cut)
  const baselineTrain = evaluate(environment, train, options)
  const baselineValidation = evaluate(environment, validation, options)
  let bestWeights = { ...defaults }
  let bestTrain = baselineTrain
  let evaluations = 0
  const history = []
  for (let round = 1; round <= 3; round++) {
    for (const key of keys) {
      const base = bestWeights[key]
      let winner = bestWeights
      for (const factor of [0.5, 0.75, 1.25, 1.5, 2]) {
        const weights = { ...bestWeights, [key]: base * factor }
        const result = evaluate(environment, train, { ...options, weights })
        evaluations++
        if (result.objective > bestTrain.objective) {
          bestTrain = result
          winner = weights
        }
      }
      bestWeights = winner
    }
    history.push({ round, trainObjective: bestTrain.objective })
    options.onProgress?.(`Grid tur ${round}/3: eğitim ${bestTrain.objective.toFixed(6)}`)
  }
  return { status: "completed", evaluations, rounds: 3, bestWeights, history,
    split: { trainIds: train.map((q) => q.id), validationIds: validation.map((q) => q.id) },
    baselineTrain, baselineValidation, bestTrain,
    bestValidation: evaluate(environment, validation, { ...options, weights: bestWeights }) }
}

export function runEvaluation(options = {}, environment = loadEvaluation()) {
  const seed = options.seed ?? 1
  // Snapshot'a kazananın elosu verilmez: varsayılan auto, bilinmeyen oyuncuda Love Ball'dır.
  const tier = !options.tier || options.tier === "auto" ? "LOVE_BALL" : options.tier
  if (!environment.meta.pokemons[tier] || !environment.meta.items[tier]) throw new Error(`Bilinmeyen tier: ${tier}`)
  const questions = createQuestions(environment, { ...options, seed })
  const baseline = evaluate(environment, questions, { tier })
  return { seed, tier, minGames: 50, availableTeams: environment.meta.clusters.reduce((n, c) => n + c.topTeams.length, 0),
    unknownUnits: questions.reduce((n, q) => n + q.unknownUnits, 0),
    methodology: "Kazananı geri kurma vekil ölçümü; tek doğru etiket. Seçenekler karıştırılır, eşitlik giriş sırasıyla çözülür. Meta ve takımlar aynı fixture'dan; grid ayrımı yalnız ağırlık aramasını doğrular.",
    baseline, ...(options.grid ? { grid: searchWeights(environment, questions, { ...options, seed, tier }) } : {}) }
}

export function parseArgs(args) {
  const options = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (["--json", "--grid", "--help"].includes(arg)) options[arg.slice(2)] = true
    else if (["--seed", "--tier", "--limit"].includes(arg)) {
      const value = args[++i]
      if (!value || value.startsWith("--")) throw new Error(`${arg} bir değer gerektirir.`)
      options[arg.slice(2)] = arg === "--tier" ? value : Number(value)
    } else throw new Error(`Bilinmeyen seçenek: ${arg}`)
  }
  if (options.seed !== undefined && (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff)) {
    throw new Error("--seed 0..4294967295 arasında bir tamsayı olmalı.")
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit pozitif tamsayı olmalı.")
  return options
}

export function formatReport(report) {
  const pct = (n) => n === null ? "ölçülemedi" : `${(n * 100).toFixed(2)}%`
  const lines = [`PACC değerlendirme — seed=${report.seed}, tier=${report.tier}, takım=${report.baseline.teams}/${report.availableTeams}, minGames=${report.minGames}`,
    "Görev       | n (atlanan) | Motor    | Rastgele | Ek ölçüm", "------------|-------------|----------|----------|------------------"]
  for (const [key, task] of Object.entries(report.baseline.tasks)) {
    const extra = key === "T1" ? `MRR=${task.mrr?.toFixed(4)} (rastgele ${task.randomMrr?.toFixed(4)})`
      : key === "T2" ? `Taşıyıcı=${pct(task.carrier.accuracy)} (n=${task.carrier.n})` : ""
    lines.push(`${key.padEnd(11)} | ${`${task.n} (${task.skipped})`.padEnd(11)} | ${pct(task.top1 ?? task.recallAt3 ?? null).padEnd(8)} | ${pct(task.random).padEnd(8)} | ${extra}`)
  }
  lines.push(`Amaç (T1, T2, T3 ortalaması, T4 eşit ağırlık): ${pct(report.baseline.objective)}`,
    `Bilinmeyen birim: ${report.unknownUnits}. ${report.methodology}`)
  if (report.grid?.status === "skipped") lines.push(report.grid.reason)
  if (report.grid?.status === "completed") {
    const g = report.grid
    lines.push(`Grid: ${g.split.trainIds.length} eğitim / ${g.split.validationIds.length} doğrulama, ${g.evaluations} deneme.`,
      `Eğitim: ${pct(g.baselineTrain.objective)} → ${pct(g.bestTrain.objective)}`,
      `Doğrulama: ${pct(g.baselineValidation.objective)} → ${pct(g.bestValidation.objective)}`,
      `En iyi ağırlıklar: ${JSON.stringify(g.bestWeights)}`)
  }
  return lines.join("\n")
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log("node scripts/eval-advice.mjs [--seed 1] [--tier LOVE_BALL|auto] [--limit 120] [--json] [--grid]")
    } else {
      const report = runEvaluation({ ...options, onProgress: (message) => console.error(message) })
      console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report))
    }
  } catch (error) {
    console.error(`Değerlendirme hatası: ${error.message}`)
    process.exitCode = 1
  }
}
