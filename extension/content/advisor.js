// Öneri motoru: oyundaki durumun (game-hook.js'ten gelen özet) ve meta verisinin
// üzerinden dizilim, item, dükkan ve karusel önerileri hesaplar. DOM'a dokunmaz;
// panel.js sonucu ekrana çizer.

;(() => {
  const EMPTY = new Set(["DEFAULT", ""])

  // Dış sözleşme: ctx.weights bu donmuş varsayılanları ezebilir. *_W karışım oranı,
  // *_BONUS ek puan, *_CAP üst sınır, *_MIN/*_GAP karar eşiğidir; puanlar 0–100.
  // PKM/ITEM meta-takım karışımı; SYN/COPY/COMP takım sinyalleri; PLAN plana güven;
  // FIT bölgesel/ek seçim ölçeği; START/BONUS başlangıç; REASON/TAG/GAP açıklama ve karar;
  // HOLDER taşıyıcı tercihi, gelişimi ve boş yuvası; CRAFT hemen yap sırası;
  // PLANNER/CAROUSEL/PORTAL ilgili arayüz katkılarıdır. Ölçek dönüşümleri (10/100) sabittir.
  const WEIGHTS = Object.freeze({
    PKM_META_W: 0.15, PKM_TEAM_W: 0.5, ITEM_META_W: 0.6, ITEM_TEAM_W: 0.28125,
    UNKNOWN_META: 17.5, UNKNOWN_ITEM_META: 50, META_STRONG: 55, TEAM_FIT: 30,
    SYN_NEXT_BONUS: 30, SYN_BONUS: 25, SYN_CAP: 90, COPY_BONUS: 35, COMP_BONUS: 67.5,
    PLAN_FAMILY_BONUS: 65, PLAN_EARLY_W: 0.8, PLAN_MIN_W: 0.1, PLAN_MAX_W: 0.9,
    PLAN_EARLY_UNITS: 3, PLAN_REASON_MIN: 0.5,
    // PLANNER_CORE_MIN: planlayıcı çekirdeği eşiği; değerlendirme ölçmediği için eski 0.25 değeri korunur
    CORE_FREQUENCY_MIN: 0.09375, PLANNER_CORE_MIN: 0.25, SHOP_CORE_MIN: 0.4, SHOP_OVERLAP_MIN: 0.15,
    COMP_SHOP_W: 0.5, COMP_OVERLAP_W: 24, COMP_RANK_W: 0.3, RANK_BASE: 4.5,
    FIT_SYN_BONUS: 2, FIT_NEXT_BONUS: 2, FIT_COMP_BONUS: 2, FIT_META_W: 1,
    START_RANK_BASE: 7, START_RANK_W: 1.2, START_COMP_BASE: 5, START_COMP_W: 0.6,
    START_DIVERSITY_W: 0.2, START_POP_CAP: 0.4, START_POP_W: 0.04, START_COMP_BONUS: 5,
    BONUS_RANK_BASE: 6, BONUS_RANK_W: 0.5, BONUS_META_W: 0.1,
    REASON_META_STRONG: 30, REASON_META_WEAK: 10, REASON_CORE: 8,
    TAG_PCT_MIN: 40, GOOD_GAP: 10, AVOID_GAP: 25, AVOID_MAX: 40,
    HOLDER_WANTED: 77.5, HOLDER_ORDER_PENALTY: 3, HOLDER_POPULAR: 48,
    HOLDER_STAR_W: 4.5, HOLDER_RARITY_W: 2, HOLDER_META_W: 0.05, HOLDER_HELD_W: 3,
    HOLDER_BENCH_W: 0.5, HOLDER_FUTURE_W: 0.65, HOLDER_COMPONENT_W: 0.225,
    HOLDER_CRAFT_W: 0.85, HOLDER_UNKNOWN: 0,
    CRAFT_ORDER_W: 0.6, CRAFT_META_W: 0.4, CRAFT_ORDER_PENALTY: 15, CRAFT_STAR_W: 4,
    CRAFT_HOLDER_W: 0.2,
    PLANNER_COMP_W: 50, PLANNER_SYN_W: 30, PLANNER_META_W: 0.2, PLANNER_COMP_BASE: 0.5,
    CAROUSEL_COMP_BONUS: 30, PORTAL_ACTIVE_BONUS: 10, PORTAL_NEAR_BONUS: 12,
    PORTAL_SYN_CAP: 50, PORTAL_REGIONAL_W: 0.3, PORTAL_META_W: 0.2
  })

  const ELO_RANK_THRESHOLD = Object.freeze({ LEVEL_BALL: 0, NET_BALL: 1050, SAFARI_BALL: 1100,
    LOVE_BALL: 1150, PREMIER_BALL: 1200, QUICK_BALL: 1250, POKE_BALL: 1300,
    SUPER_BALL: 1350, ULTRA_BALL: 1400, MASTER_BALL: 1500, BEAST_BALL: 1600 })
  const tierViewCache = new WeakMap()

  // Ortak arayüz bağlamı. Her kayıt yeterli örnek bulunan en yakın alt elodan gelir.
  // Önbellek anahtarı meta nesnesi + hedef seviye + minGames; kaynak veri değişmez.
  function buildContext({ data, meta, settings = {}, snap, t, names, weights, plan } = {}) {
    const tiers = Object.keys(ELO_RANK_THRESHOLD)
    const minGames = Number.isFinite(settings?.minGames) ? Math.max(0, settings.minGames) : 50
    let target = settings?.tier
    if (!target || target === "auto" || !tiers.includes(target)) {
      const elo = Number.isFinite(snap?.elo) ? snap.elo : ELO_RANK_THRESHOLD.LOVE_BALL
      target = tiers.filter((tier) => ELO_RANK_THRESHOLD[tier] <= Math.max(elo, ELO_RANK_THRESHOLD.LOVE_BALL)).at(-1)
    }
    let view = null
    if (meta && typeof meta === "object") {
      let cache = tierViewCache.get(meta)
      if (!cache) tierViewCache.set(meta, (cache = new Map()))
      const key = `${target}:${minGames}`
      view = cache.get(key)
      if (!view) {
        const merge = (source = {}) => {
          const out = {}
          for (const tier of tiers.slice(0, tiers.indexOf(target) + 1).reverse()) {
            for (const [name, stat] of Object.entries(source[tier] ?? {})) {
              if (!Array.isArray(stat) || out[name]?.[1] >= minGames) continue
              out[name] = stat
            }
          }
          return out
        }
        view = { tierPokemons: merge(meta.pokemons), tierItems: merge(meta.items) }
        cache.set(key, view)
      }
    }
    return { data, tierPokemons: view?.tierPokemons ?? {}, tierItems: view?.tierItems ?? {},
      clusters: meta?.clusters ?? [], minGames, thresholds: meta?.thresholds ?? null,
      regionsMeta: meta?.regions ?? {}, targetTier: target, snap, plan, t, names, weights }
  }

  // Gerekçe metinleri katalog anahtarıdır (extension/i18n/*.json, "advice.*"). ctx.t yoksa PacI18n
  // (İngilizce varsayılan) kullanılır; ikisi de yoksa anahtarın kendisi döner.
  function T(ctx, key, vars) {
    const t = typeof ctx?.t === "function" ? ctx.t : window.PacI18n?.t
    return t ? t(key, vars) : key
  }

  function familyOf(data, pkm) {
    return data.family?.[pkm] ?? pkm
  }

  // Evrim ailesi sıralı: [temel, ..., son]; dallanmada (ör. Gardevoir/Gallade) hepsi, yıldız sonra ada göre.
  // Evrim zinciri tahta rozetleri için saniyede onlarca kez istenir; aile başına bir kez hesapla
  const chainCache = new WeakMap()
  function familyChain(data, pkm) {
    const base = familyOf(data, pkm)
    let byBase = chainCache.get(data)
    if (!byBase) chainCache.set(data, (byBase = new Map()))
    let chain = byBase.get(base)
    if (!chain) {
      const members = Object.keys(data.pokemons).filter((name) => familyOf(data, name) === base)
      if (!members.includes(base)) members.push(base)
      const stars = (name) => data.pokemons[name]?.[1] ?? 0
      chain = members.sort((a, b) => (a === base ? -1 : b === base ? 1 : 0) || stars(a) - stars(b) || a.localeCompare(b))
      byBase.set(base, chain)
    }
    return [...chain]
  }

  // Bir Pokémon için meta istatistiği: önce kendisi, yoksa aynı ailenin en çok
  // oynanan üyesi (ör. tahtada Charmeleon varsa Charizard'ın itemleri).
  // Aile dizini: meta'daki ~1200 Pokémonu her çağrıda baştan taramak yerine aile başına
  // sonuçları bir kez hesaplar. Portal ve planlayıcı önerileri bunu yüzlerce kez çağırıyordu
  // (oyunda takılmaya yol açan O(n²) döngü). Anahtar: tierPokemons nesnesi + minGames.
  const familyIndexCache = new WeakMap()
  function familyIndex(ctx) {
    const tier = ctx.tierPokemons
    if (!tier || typeof tier !== "object") return new Map()
    const minGames = ctx.minGames ?? 0
    let byMin = familyIndexCache.get(tier)
    if (!byMin) familyIndexCache.set(tier, (byMin = new Map()))
    let index = byMin.get(minGames)
    if (index) return index
    index = new Map()
    for (const [name, stat] of Object.entries(tier)) {
      if (!Array.isArray(stat)) continue
      const fam = familyOf(ctx.data, name)
      const entry = index.get(fam) ?? { played: null, best: null }
      // statFor: ailenin item verisi olan en çok oynanan üyesi
      if (stat[3]?.length && (!entry.played || stat[1] > entry.played.stat[1])) entry.played = { name, stat }
      // bestFamilyRank: yeterli oyunu olan en iyi ortalama sıra
      if (stat[1] >= minGames && (!entry.best || stat[0] < entry.best.rank)) entry.best = { name, rank: stat[0] }
      index.set(fam, entry)
    }
    byMin.set(minGames, index)
    return index
  }

  function statFor(ctx, pkm) {
    const tier = ctx.tierPokemons
    if (tier[pkm]?.[3]?.length) return { name: pkm, stat: tier[pkm] }
    return familyIndex(ctx).get(familyOf(ctx.data, pkm))?.played ?? null
  }

  function countBy(list) {
    const m = new Map()
    for (const x of list) m.set(x, (m.get(x) ?? 0) + 1)
    return m
  }

  // Elde verilen parçalarla bir item yapılabilir mi? (hazır item, ya da iki parça)
  function craftStatus(ctx, item, inventory) {
    const inv = countBy(inventory)
    if (inv.get(item)) return { state: "have" }
    const r = ctx.data.recipes?.[item]
    if (!r) return { state: "none" }
    const [a, b] = r
    const need = countBy([a, b])
    let missing = []
    for (const [comp, n] of need) {
      const have = inv.get(comp) ?? 0
      for (let i = have; i < n; i++) missing.push(comp)
    }
    if (missing.length === 0) return { state: "craftable", recipe: r }
    if (missing.length === 1) return { state: "one-missing", recipe: r, missing }
    return { state: "far", recipe: r, missing }
  }

  function liveComps(ctx, snap, families) {
    const W = { ...WEIGHTS, ...ctx.weights }
    const mine = new Set(snap.board.map((p) => familyOf(ctx.data, p.name)))
    const shop = new Set(snap.shop.filter((p) => !EMPTY.has(p)).map((p) => familyOf(ctx.data, p)))
    const results = []
    for (const c of ctx.clusters) {
      if (!c || !(c.count >= ctx.minGames) || !Array.isArray(c.pokemons)) continue
      const core = c.pokemons.filter((p) => p && p.frequency >= W.CORE_FREQUENCY_MIN)
      if (!core.length) continue
      let have = 0
      let fromShop = 0
      let total = 0
      for (const p of core) {
        const fam = familyOf(ctx.data, p.name)
        total += p.frequency
        if (families?.has(fam)) have += p.frequency * families.get(fam)
        else if (!families && mine.has(fam)) have += p.frequency
        else if (shop.has(fam)) fromShop += p.frequency
      }
      if (have === 0) continue
      const overlap = (have + W.COMP_SHOP_W * fromShop) / total
      // eşleşme ağırlıklı, aynı eşleşmede ortalama sırası iyi olan önde
      const score = overlap * W.COMP_OVERLAP_W + (W.RANK_BASE - c.rank) * W.COMP_RANK_W
      results.push({ cluster: c, overlap, score, core })
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 3)
  }

  function suggestComps(ctx, snap) {
    return liveComps(ctx, snap, teamContext(ctx, snap).families)
  }

  function suggestItems(ctx, snap, inventory) {
    const team = teamContext(ctx, snap)
    // Tahtadaki (yedek değil) Pokémonlar önce, sonra yıldıza göre
    const units = [...snap.board]
      .filter((p) => !EMPTY.has(p.name))
      .sort((a, b) => (b.y > 0) - (a.y > 0) || b.stars - a.stars)
    return units.map((u) => {
      const s = statFor(ctx, u.name)
      const wanted = holderWants(ctx, u.name).filter((it) => !u.items.includes(it) && u.items.length < 3)
      return {
        unit: u,
        source: s?.name,
        place: s?.stat[0],
        recs: wanted.map((it) => ({ item: it, ...craftStatus(ctx, it, inventory ?? []),
          fit: itemHolderFit(ctx, team, it).score }))
      }
    })
  }

  // Eldeki parçalardan yapılabilecek, takımında birinin istediği itemler
  function craftNow(ctx, itemAdvice, inventory) {
    if (!inventory) return []
    const out = []
    const seen = new Set()
    const team = liveHolders(teamContext(ctx, { board: itemAdvice.map((a) => a.unit), inventory, shop: [] }))
    for (const a of itemAdvice) {
      if (a.unit.y === 0) continue
      for (const r of a.recs) {
        if (r.state !== "craftable" || seen.has(r.item)) continue
        seen.add(r.item)
        const fit = itemHolderFit(ctx, team, r.item)
        if (!fit.holder || !(fit.holder.y > 0) || fit.future) continue
        out.push({ item: r.item, recipe: r.recipe, for: fit.holder.name })
      }
    }
    return out
  }

  // Karusel / PvE ödül seçimi: hangi item takımına daha çok yarar?
  function rankPropositions(ctx, snap, itemAdvice) {
    const props = snap.itemsProposition.filter((x) => !EMPTY.has(x))
    if (!props.length) return []
    return props
      .map((p) => {
        const plan = itemPlan(ctx, snap, p, itemAdvice)
        return { item: p, score: plan?.score ?? 0, uses: plan?.result ? [plan.result] : [], reason: plan?.reason ?? null }
      })
      .sort((a, b) => b.score - a.score)
  }

  const popularHolderCache = new WeakMap()
  // Item metası ters dizini: aile→popüler itemler; her saniye tüm itemleri taramayız.
  function popularItems(ctx) {
    const tier = ctx.tierItems
    if (!tier || typeof tier !== "object") return new Map()
    let byData = popularHolderCache.get(tier)
    if (!byData) popularHolderCache.set(tier, (byData = new WeakMap()))
    let index = byData.get(ctx.data)
    if (index) return index
    index = new Map()
    for (const [item, stat] of Object.entries(tier)) {
      if (!Array.isArray(stat)) continue
      for (const pkm of plannerHeld(stat[2])) {
        const fam = familyOf(ctx.data, pkm)
        if (!index.has(fam)) index.set(fam, [])
        index.get(fam).push(item)
      }
    }
    byData.set(ctx.data, index)
    return index
  }

  function holderWants(ctx, pkm) {
    const source = statFor(ctx, pkm)
    const wanted = source && source.stat[1] >= ctx.minGames ? plannerHeld(source.stat[3]).slice(0, 3) : []
    return [...new Set([...wanted, ...(popularItems(ctx).get(familyOf(ctx.data, pkm)) ?? [])
      .filter((item) => (ctx.tierItems[item]?.[1] ?? 0) >= ctx.minGames)])]
  }

  // Dış API: en uygun boş yuvalı taşıyıcı, 0–100 puanı ve yerelleştirilmiş gerekçeleri.
  // team, teamContext çıktısıdır (snapshot da kabul edilir). Ek alanlar tarif/gelecek kullanımını açıklar.
  function itemHolderFit(ctx, team, item) {
    const W = { ...WEIGHTS, ...ctx.weights }
    if (!team?.units) team = teamContext(ctx, Array.isArray(team) ? { board: team } : team)
    const holderKey = JSON.stringify(ctx.weights ?? {})
    let fits = team.holders.get(holderKey)
    if (!fits) team.holders.set(holderKey, (fits = new Map()))
    if (fits.has(item)) return fits.get(item)
    let best = { holder: null, score: W.HOLDER_UNKNOWN, reasons: [] }
    const current = new Set(team.units.map((u) => familyOf(ctx.data, u.name)))
    const candidates = [...team.units.map((holder) => ({ holder, weight: holder.y > 0 ? 1 : W.HOLDER_BENCH_W, future: false })),
      ...team.planned.filter((u) => !current.has(familyOf(ctx.data, u.name)))
        .map((holder) => ({ holder, weight: team.planWeight * W.HOLDER_FUTURE_W, future: true }))]
    for (const { holder, weight, future } of candidates) {
      if (holder.items.length >= 3 || holder.items.includes(item) || !weight) continue
      const source = statFor(ctx, holder.name)
      const top = source && source.stat[1] >= ctx.minGames ? plannerHeld(source.stat[3]).slice(0, 3) : []
      const fam = familyOf(ctx.data, holder.name)
      const preference = (target) => {
        if (holder.items.includes(target)) return 0
        const order = top.indexOf(target)
        const stat = ctx.tierItems?.[target]
        const popular = stat?.[1] >= ctx.minGames && plannerHeld(stat[2]).some((p) => familyOf(ctx.data, p) === fam)
        return (order >= 0 ? W.HOLDER_WANTED - order * W.HOLDER_ORDER_PENALTY : 0) + (popular ? W.HOLDER_POPULAR : 0)
      }
      let signal = preference(item)
      let result = null
      let other = null
      let partial = false
      for (const target of holderWants(ctx, holder.name)) {
        const recipe = ctx.data.recipes?.[target]
        if (!recipe?.includes(item) || !preference(target)) continue
        const before = craftStatus(ctx, target, team.inventory ?? [])
        if (["have", "craftable"].includes(before.state)) continue
        const craftable = team.inventory && craftStatus(ctx, target, [...team.inventory, item]).state === "craftable"
        const candidate = preference(target) * (craftable ? W.HOLDER_CRAFT_W : W.HOLDER_COMPONENT_W)
        if (candidate > signal) {
          signal = candidate
          result = target
          other = recipe[0] === item ? recipe[1] : recipe[0]
          partial = !craftable
        }
      }
      if (!signal) continue
      const rarity = ctx.data.rules?.shopRarities ?? ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA"]
      const carry = W.HOLDER_STAR_W * ((holder.stars ?? ctx.data.pokemons[holder.name]?.[1] ?? 1) - 1) +
        W.HOLDER_RARITY_W * Math.max(0, rarity.indexOf(ctx.data.pokemons[holder.name]?.[0])) +
        W.HOLDER_META_W * (metaPct(source?.stat[0]) ?? 0) + W.HOLDER_HELD_W * holder.items.length
      const score = clampPct((signal + carry) * weight)
      if (score <= best.score) continue
      const target = displayName(ctx, "pkm", holder.name)
      const reason = !result ? T(ctx, future ? "advice.planItem" : "advice.giveDirect", { target }) : partial
        ? T(ctx, "advice.componentFor", { target, item: displayName(ctx, "item", result) })
        : T(ctx, "advice.craftWith", { target, other: displayName(ctx, "item", other), result: displayName(ctx, "item", result) })
      best = { holder, score, reasons: [reason, contextReason(ctx, team)], result, other, partial, future }
    }
    fits.set(item, best)
    return best
  }

  // Hemen yap önerisi yalnız sahadaki gerçek taşıyıcılar arasında seçim yapar.
  // Güçlü bir yedek/gelecek taşıyıcı, sahadaki uygun hedefi gizlememelidir.
  function liveHolders(team) {
    return team.immediate ??= { ...team, units: team.units.filter((u) => u.y > 0), planned: [], holders: new Map() }
  }

  // Seçilen itemin canlı veya planlanan taşıyıcısını panelde de aynı puanla göster.
  function itemPlan(ctx, snap, item, itemAdvice) {
    const fit = itemHolderFit(ctx, teamContext(ctx, snap), item)
    if (!fit.holder || fit.partial) return null
    return { score: fit.score / 10, result: fit.result, reason: fit.reasons.join(" · "),
      carouselReason: { kind: fit.result ? "craft" : "want", pkm: fit.holder.name, item: fit.result ? fit.other : item } }
  }

  function shopAdvice(ctx, snap) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const team = teamContext(ctx, snap)
    const copies = new Map()
    for (const unit of snap.board) {
      const fam = familyOf(ctx.data, unit.name)
      copies.set(fam, (copies.get(fam) ?? 0) + (unit.stars >= 3 ? 9 : unit.stars === 2 ? 3 : 1))
    }
    const active = boardFamilies(ctx, snap)
    const counts = synergyCounts(ctx, snap)
    // Dükkânın kendisi dizilim eşleşmesini şişirmesin: yalnız eldeki takımla uyumlu kümelere bak.
    const groundedComps = suggestComps(ctx, { ...snap, shop: [] })
      .filter((comp) => {
        const activeMatches = comp.core.filter((p) => active.has(familyOf(ctx.data, p.name))).length
        return comp.overlap >= W.SHOP_OVERLAP_MIN && activeMatches >= (active.size >= 3 ? 2 : 1)
      })
    return snap.shop
      .map((pkm, i) => ({ pkm, i }))
      .filter(({ pkm }) => !EMPTY.has(pkm))
      .map(({ pkm, i }) => {
        const fam = familyOf(ctx.data, pkm)
        const reasons = []
        const owned = copies.get(fam) ?? 0
        const stages = ctx.data.pokemons[fam]?.[5] ?? 3
        const needed = stages >= 3 ? 9 : stages === 2 ? 3 : 1
        if (owned >= needed) return { pkm, slot: i, reasons }
        const metaFit = groundedComps.find((comp) => comp.core.some((p) =>
          p.frequency >= W.SHOP_CORE_MIN && familyOf(ctx.data, p.name) === fam))
        if (metaFit && !owned) {
          const member = metaFit.core.find((p) => p.frequency >= W.SHOP_CORE_MIN && familyOf(ctx.data, p.name) === fam).name
          const evolves = member !== pkm
            ? T(ctx, "advice.evolves", { from: displayName(ctx, "pkm", pkm), to: displayName(ctx, "pkm", member) })
            : ""
          reasons.push(evolves + T(ctx, "advice.metaCore", { rank: metaFit.cluster.rank.toFixed(1) }))
        }
        if (owned > 0 && owned < needed && (active.has(fam) || metaFit)) {
          reasons.push(T(ctx, "advice.copyShop", { owned, needed }))
        }
        if (reasons.length && !owned) {
          for (const syn of typesOf(ctx, pkm)) {
            const count = counts[syn] ?? 0
            if (!count) continue
            const next = ctx.thresholds?.[syn]?.find((step) => step > count)
            if (next === count + 1 && !active.has(fam)) {
              reasons.push(...fitReasons(ctx, snap, [{ kind: "next", syn }]))
            }
          }
        }
        if (team.planWeight >= W.PLAN_REASON_MIN && team.planned.some((p) => familyOf(ctx.data, p.name) === fam)) {
          reasons.unshift(contextReason(ctx, team))
        } else if (reasons.length) reasons[0] += ` · ${contextReason(ctx, team)}`
        return { pkm, slot: i, reasons: reasons.slice(0, 3) }
      })
      .filter((s) => s.reasons.length)
  }

  const typesOf = (ctx, pkm) => ctx.data.pokemons[pkm]?.[2] ?? []

  // Tahtadaki (yedek değil) ailelerin kümesi — oyun sinerjiyi aile başına bir kez sayar
  const boardFamilies = (ctx, snap) => perSnap("families", ctx, snap, () => new Set(snap.board.filter((p) => p.y > 0).map((p) => familyOf(ctx.data, p.name))))

  // Snapshotlar değişmez kabul edilir (teamCache gibi): aile/sinerji sayımı snapshot başına bir kez yapılır.
  // Portal sıralaması tek çağrıda yüzlerce bölgesel Pokémonu puanlar; her biri bunları yeniden sayıyordu.
  const snapCache = new WeakMap()
  function perSnap(key, ctx, snap, compute) {
    if (!snap || typeof snap !== "object") return compute()
    let entry = snapCache.get(snap)
    if (!entry || entry.data !== ctx.data) snapCache.set(snap, (entry = { data: ctx.data }))
    return entry[key] ??= compute()
  }

  // Redux sinerjileri boş/gecikmiş olsa bile sahadaki birimlerden takım uyumunu çıkar.
  function synergyCounts(ctx, snap) {
    return perSnap("synergies", ctx, snap, () => countSynergies(ctx, snap))
  }

  function countSynergies(ctx, snap) {
    const counts = {}
    const seen = new Set()
    for (const unit of snap.board ?? []) {
      if (unit.y <= 0 || !unit.name) continue
      const family = familyOf(ctx.data, unit.name)
      if (seen.has(family)) continue
      seen.add(family)
      const types = unit.types?.length ? unit.types : typesOf(ctx, unit.name)
      for (const type of new Set(types)) counts[type] = (counts[type] ?? 0) + 1
    }
    // Canlı sayaç item ve özel etkilerden gelen ek türleri de içerir.
    for (const [type, count] of Object.entries(snap.synergies ?? {})) {
      if (Number.isFinite(count)) counts[type] = Math.max(counts[type] ?? 0, count)
    }
    return counts
  }

  const EMPTY_PLAN = Object.freeze([])
  const teamCache = new WeakMap()
  // Tüm önericilerin ortak takım görünümü. units canlı tahta+yedek, planned hedef plandır.
  // families aile→ağırlık Map'i, synergies plan/canlı sayılarının ağırlıklı birleşimidir.
  // Snapshotlar değişmez kabul edilir; aynı turdaki tekrarlar (ve item hesapları) önbellekten gelir.
  function teamContext(ctx, snap = {}, plan = ctx.plan ?? snap?.plan ?? EMPTY_PLAN) {
    snap ??= {}
    const W = { ...WEIGHTS, ...ctx.weights }
    // Grid araması aynı weights nesnesini yerinde değiştirebilir; değerler anahtara dahildir.
    const weightKey = JSON.stringify(ctx.weights ?? {})
    let entries = teamCache.get(snap)
    if (!entries) teamCache.set(snap, (entries = []))
    const cached = entries.find((e) => e.data === ctx.data && e.tier === ctx.tierPokemons &&
      e.clusters === ctx.clusters && e.thresholds === ctx.thresholds && e.min === ctx.minGames &&
      e.plan === plan && e.weights === weightKey && e.items === ctx.tierItems && e.t === ctx.t && e.names === ctx.names && e.lang === window.PacI18n?.lang)
    if (cached) return cached.team
    const units = plannerUnits(snap.board).map((u) => ({ ...u, items: plannerHeld(u.items) }))
    const planned = plannerUnits(plan).map((u) => ({ ...u, y: u.y ?? 1, items: plannerHeld(u.items) }))
    const owned = new Set(units.map((u) => familyOf(ctx.data, u.name)))
    const targets = new Set(planned.map((u) => familyOf(ctx.data, u.name)))
    const adherence = targets.size ? [...targets].filter((f) => owned.has(f)).length / targets.size : 0
    const planWeight = Math.max(0, Math.min(1, !targets.size ? 0 : units.filter((u) => u.y > 0).length < W.PLAN_EARLY_UNITS
      ? W.PLAN_EARLY_W : W.PLAN_MIN_W + (W.PLAN_MAX_W - W.PLAN_MIN_W) * adherence))
    const live = { ...snap, board: units, shop: [] }
    const future = { board: planned, shop: [], synergies: {} }
    const liveSynergies = synergyCounts(ctx, live)
    const plannedSynergies = synergyCounts(ctx, future)
    const families = new Map([...owned].map((fam) => [fam, 1 - planWeight]))
    const liveMatches = liveComps(ctx, live)
    const futureMatches = liveComps(ctx, future)
    const core = liveMatches[0]?.core ?? []
    for (const p of core) {
      const fam = familyOf(ctx.data, p.name)
      families.set(fam, Math.max(families.get(fam) ?? 0, (1 - planWeight) * p.frequency))
    }
    for (const fam of targets) families.set(fam, Math.min(1, (families.get(fam) ?? 0) + planWeight))
    const synergies = Object.fromEntries([...new Set([...Object.keys(liveSynergies), ...Object.keys(plannedSynergies)])]
      .map((syn) => [syn, (liveSynergies[syn] ?? 0) * (1 - planWeight) + (plannedSynergies[syn] ?? 0) * planWeight]))
    const team = { units, planned, adherence, planWeight: Math.max(0, Math.min(1, planWeight)), synergies, families,
      live, future, liveMatches, futureMatches, liveSynergies, plannedSynergies, inventory: Array.isArray(snap.inventory) ? snap.inventory : null,
      holders: new Map() }
    if (entries.length >= 8) entries.shift()
    entries.push({ data: ctx.data, tier: ctx.tierPokemons, clusters: ctx.clusters, thresholds: ctx.thresholds,
      min: ctx.minGames, plan, weights: weightKey, items: ctx.tierItems, t: ctx.t, names: ctx.names, lang: window.PacI18n?.lang, team })
    return team
  }

  function contextKind(ctx, team) {
    const W = { ...WEIGHTS, ...ctx.weights }
    return team.planWeight >= W.PLAN_REASON_MIN ? "plan" : "live"
  }
  const contextReason = (ctx, team) => T(ctx, `advice.context.${contextKind(ctx, team)}`)

  // ---------- 1) Sinerji sayacı ----------
  function synergyTracker(ctx, snap) {
    const th = ctx.thresholds
    if (!th) return []
    const onBoard = boardFamilies(ctx, snap)
    const out = []
    for (const [syn, count] of Object.entries(synergyCounts(ctx, snap))) {
      const steps = th[syn]
      if (!steps || !count) continue
      const tier = steps.filter((t) => t <= count).length
      const next = steps.find((t) => t > count)
      const need = next ? next - count : 0
      // Sinerjiyi artırabilecek adaylar: tahtada olmayan bir aileden, o tipe sahip Pokémon
      const fits = (pkm) => typesOf(ctx, pkm).includes(syn) && !onBoard.has(familyOf(ctx.data, pkm))
      const fromBench = need ? [...new Set(snap.board.filter((p) => p.y === 0 && fits(p.name)).map((p) => p.name))] : []
      const fromShop = need ? [...new Set(snap.shop.filter((p) => !EMPTY.has(p) && fits(p)))] : []
      out.push({ syn, count, tier, steps, next, need, fromBench, fromShop })
    }
    // Aktif olanlar önce; aynı durumda bir sonraki seviyeye en yakın olan önce
    return out.sort((a, b) => b.tier - a.tier || (a.need || 99) - (b.need || 99) || b.count - a.count)
  }

  // Bir Pokémonun ailesinin meta'daki en iyi ortalama sırası (yeterli oyunu olan)
  function bestFamilyRank(ctx, pkm) {
    return familyIndex(ctx).get(familyOf(ctx.data, pkm))?.best ?? null
  }

  // Bir Pokémonun takımına ne kadar uyduğunu puanlar (ek seçim ve bölgesel öneri için ortak).
  // reasons: { kind: "next" | "syn" | "comp", syn? } — panel seçili dilde metne çevirir
  function liveFitScore(ctx, snap, comps, pkm) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const reasons = []
    let score = 0
    const th = ctx.thresholds ?? {}
    const fam = familyOf(ctx.data, pkm)
    const mine = boardFamilies(ctx, snap)
    if (!mine.has(fam)) {
      const counts = synergyCounts(ctx, snap)
      for (const t of typesOf(ctx, pkm)) {
        const c = counts[t] ?? 0
        if (!c) continue
        const next = th[t]?.find((x) => x > c)
        score += W.FIT_SYN_BONUS + (next && next - c === 1 ? W.FIT_NEXT_BONUS : 0)
        reasons.push({ kind: next && next - c === 1 ? "next" : "syn", syn: t })
      }
    }
    const inComp = comps.find((r) => r.core.some((p) => familyOf(ctx.data, p.name) === fam) &&
      r.core.some((p) => mine.has(familyOf(ctx.data, p.name))))
    if (inComp) {
      score += W.FIT_COMP_BONUS
      reasons.push({ kind: "comp" })
    }
    const best = bestFamilyRank(ctx, pkm)
    if (best) score += Math.max(0, W.RANK_BASE - best.rank) * W.FIT_META_W
    return { score, reasons, best }
  }

  // ---------- 2) Ek / eşsiz Pokémon seçimi ----------
  function rankPokemonPropositions(ctx, snap, comps) {
    return (snap.pokemonsProposition ?? [])
      .map((opt) => {
        const members = Array.isArray(opt) ? opt : (ctx.data.duos[opt] ?? [opt])
        const fits = members.map((m) => fitScore(ctx, snap, comps, m))
        return {
          option: Array.isArray(opt) ? opt.join("_") : opt,
          members,
          score: fits.reduce((s, f) => s + f.score, 0) / members.length,
          reasons: [...new Map(fits.flatMap((f) => f.reasons).map((r) => [r.kind + (r.syn ?? ""), r])).values()],
          best: fits.map((f) => f.best).filter(Boolean).sort((a, b) => a.rank - b.rank)[0] ?? null
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  // ---------- 3) Ekonomi ----------
  function economy(ctx, snap) {
    const money = snap.money ?? 0
    const maxInterest = snap.maxInterest ?? 5
    const interest = Math.min(maxInterest, Math.floor(money / 10))
    const streakBonus = Math.min(5, snap.streak ?? 0)
    const income = 5 + interest + streakBonus
    const xpLeft = Math.max(0, (snap.expNeeded ?? 0) - (snap.experience ?? 0))
    const levelCost = Math.ceil(xpLeft / 4) * 4
    const atMaxLevel = snap.maxLevel && snap.level >= snap.maxLevel
    const tips = []

    const lowLife = (snap.life ?? 100) <= 30
    if (lowLife && money >= 10) {
      tips.push(["warn", T(ctx, "advice.eco.lowLife", { life: snap.life })])
    } else if (interest < maxInterest) {
      const toNext = (interest + 1) * 10 - money
      if (toNext <= 4) tips.push(["info", T(ctx, "advice.eco.interestNext", { gold: toNext, next: interest + 1 })])
    }
    const excess = money - maxInterest * 10
    if (excess >= 4 && !lowLife) tips.push(["good", T(ctx, "advice.eco.interestMax", { max: maxInterest, excess })])
    if (!atMaxLevel && xpLeft > 0) {
      const floor = Math.floor(money / 10) * 10
      if (lowLife && levelCost > 0 && levelCost <= money) {
        tips.push(["good", T(ctx, "advice.eco.levelNow", { cost: levelCost, level: snap.level + 1 })])
      } else if (levelCost <= money - Math.min(floor, maxInterest * 10) && levelCost > 0) {
        tips.push(["good", T(ctx, "advice.eco.levelKeepInterest", { cost: levelCost, level: snap.level + 1 })])
      } else if (levelCost <= money) {
        tips.push(["info", T(ctx, "advice.eco.levelCost", { cost: levelCost, level: snap.level + 1, xp: xpLeft })])
      }
    }
    if ((snap.streak ?? 0) >= 3) tips.push(["info", T(ctx, "advice.eco.streak", { streak: snap.streak, bonus: streakBonus })])

    const probs = ctx.data.rules.rarityProbability[Math.min(10, Math.max(1, snap.level ?? 1))] ?? []
    const nextProbs = ctx.data.rules.rarityProbability[Math.min(10, (snap.level ?? 1) + 1)] ?? []
    return { money, interest, maxInterest, income, streakBonus, xpLeft, levelCost, tips, probs, nextProbs }
  }

  // ---------- 4) Havuz ve ihtimal ----------
  function poolOdds(ctx, snap, comps) {
    const { rules, pokemons } = ctx.data
    const level = Math.min(10, Math.max(1, snap.level ?? 1))
    const probs = rules.rarityProbability[level]
    const sizeOf = (rarity, stages = 3) => rules.poolSize[rarity]?.[Math.min(3, Math.max(1, stages)) - 1] ?? 0

    // Havuzdaki türler: dükkanda çıkan 1. aşama normal Pokémonlar + oyunda seçilmiş ek Pokémonlar
    const pool = {} // baseline -> boyut
    for (const [name, [rarity, stars, , additional, regional, , hasAbility]] of Object.entries(pokemons)) {
      if (stars === 1 && !additional && !regional && hasAbility && rules.shopRarities.includes(rarity)) pool[name] = sizeOf(rarity)
    }
    for (const p of snap.additionalPokemons ?? []) {
      const d = pokemons[p]
      if (d) pool[familyOf(ctx.data, p)] = sizeOf(d[0], d[5])
    }

    const taken = {}
    for (const [name, n] of Object.entries(snap.taken ?? {})) {
      const base = familyOf(ctx.data, name)
      taken[base] = (taken[base] ?? 0) + n
    }

    const totalByRarity = {}
    for (const [base, size] of Object.entries(pool)) {
      const r = pokemons[base][0]
      totalByRarity[r] = (totalByRarity[r] ?? 0) + Math.max(0, size - (taken[base] ?? 0))
    }

    // Hedefler: elindeki 3★ olmamış aileler + önerilen dizilimin eksikleri
    const mine = {}
    for (const u of snap.board) {
      const base = familyOf(ctx.data, u.name)
      mine[base] = (mine[base] ?? 0) + (u.stars >= 3 ? 9 : u.stars === 2 ? 3 : 1)
    }
    // En üst yıldız için gereken kopya: 3 aşamalı zincirde 9, 2 aşamalıda 3
    const maxCopies = (base) => ((pokemons[base]?.[5] ?? 3) >= 3 ? 9 : 3)
    const targets = new Map()
    // why: "have" = elindeki aile, "comp" = önerilen dizilimin eksiği (panel metne çevirir)
    for (const [base, copies] of Object.entries(mine)) if (copies < maxCopies(base)) targets.set(base, "have")
    for (const p of comps[0]?.core ?? []) {
      const base = familyOf(ctx.data, p.name)
      if (!targets.has(base) && !mine[base]) targets.set(base, "comp")
    }

    const rows = []
    for (const [base, why] of targets) {
      if (!(base in pool)) continue
      const rarity = pokemons[base][0]
      const idx = rules.shopRarities.indexOf(rarity)
      const remaining = Math.max(0, pool[base] - (taken[base] ?? 0))
      const total = totalByRarity[rarity] || 1
      const pSlot = (probs[idx] ?? 0) * (remaining / total)
      const pShop = 1 - Math.pow(1 - pSlot, rules.shopSize)
      rows.push({ base, why, rarity, remaining, size: pool[base], mine: mine[base] ?? 0, need: maxCopies(base), pShop, possible: (probs[idx] ?? 0) > 0 })
    }
    return rows.sort((a, b) => (a.why === b.why ? b.pShop - a.pShop : a.why === "have" ? -1 : 1)).slice(0, 10)
  }

  // ---------- 5) Rakip ----------
  function opponentSummary(ctx, snap) {
    const o = snap.opponent
    if (!o) return null
    const th = ctx.thresholds ?? {}
    const synergies = Object.entries(o.synergies ?? {})
      .map(([syn, count]) => ({ syn, count, tier: (th[syn] ?? []).filter((t) => t <= count).length }))
      .filter((s) => s.tier > 0)
      .sort((a, b) => b.tier - a.tier || b.count - a.count)
    const carries = o.board
      .filter((u) => u.y > 0)
      .sort((a, b) => b.items.length - a.items.length || b.stars - a.stars)
      .slice(0, 3)
    return { name: o.name, life: o.life, synergies, carries, size: o.board.filter((u) => u.y > 0).length }
  }

  // ---------- 6) Bölge ----------
  function regionalAdvice(ctx, snap, comps) {
    return (snap.regionalPokemons ?? [])
      .filter((p) => !EMPTY.has(p))
      .map((p) => ({ pkm: p, ...fitScore(ctx, snap, comps, p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }

  // ---------- 7) Oyun sonu özeti ----------
  function gameSummary(ctx, snap) {
    const comps = suggestComps(ctx, snap)
    const items = suggestItems(ctx, { ...snap, board: snap.board.filter((u) => u.y > 0) }, null)
    const units = items.map((a) => {
      const s = statFor(ctx, a.unit.name)
      const recommended = s?.stat[3] ?? []
      const matched = a.unit.items.filter((it) => recommended.includes(it))
      return { unit: a.unit, recommended, matched }
    })
    const held = units.reduce((n, u) => n + u.unit.items.length, 0)
    const matched = units.reduce((n, u) => n + u.matched.length, 0)
    return { rank: snap.rank, comp: comps[0] ?? null, units, held, matched }
  }

  // ---------- 8) Tahta üstü seçim ve dükkan rozetleri ----------
  const displayName = (ctx, kind, key) => ctx.names?.[kind]?.(key) ?? key
  const verdictLabel = (ctx, verdict) => verdict === "neutral" ? "" : T(ctx, `advice.verdict.${verdict}`)
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  // Meta istatistiği ailenin başka bir üyesinden geliyorsa oyuncu neyi arayacağını görsün:
  // "Charmander → Charizard: meta ort. 3.1 sıra"
  const rankReason = (ctx, best, pkm) => pkm && best.name !== pkm
    ? T(ctx, "advice.rankFamily", { from: displayName(ctx, "pkm", pkm), to: displayName(ctx, "pkm", best.name), rank: best.rank.toFixed(1) })
    : T(ctx, "advice.rank", { name: displayName(ctx, "pkm", best.name), rank: best.rank.toFixed(1) })

  function itemMeta(ctx, item) {
    const stat = ctx.tierItems?.[item]
    return stat && stat[1] >= ctx.minGames && Number.isFinite(stat[0]) ? stat[0] : null
  }

  function bonusItem(ctx, item) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const rank = itemMeta(ctx, item)
    return {
      score: rank === null ? 0 : Math.max(0, W.BONUS_RANK_BASE - rank) * W.BONUS_RANK_W,
      rank,
      reason: !item || EMPTY.has(item) ? null : rank === null
        ? T(ctx, "advice.bonusNoMeta", { item: displayName(ctx, "item", item) })
        : T(ctx, "advice.bonus", { item: displayName(ctx, "item", item), rank: rank.toFixed(1) })
    }
  }

  // Başlangıçta takım uyumu yerine evrim ailesinin meta gücünü kullanırız.
  function starterScore(ctx, pkm) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const fam = familyOf(ctx.data, pkm)
    const best = bestFamilyRank(ctx, pkm)
    const clusters = ctx.clusters.filter((c) => c.count >= ctx.minGames && Number.isFinite(c.rank) &&
      c.pokemons.some((p) => p.frequency >= W.CORE_FREQUENCY_MIN && familyOf(ctx.data, p.name) === fam))
    const games = Object.entries(ctx.tierPokemons)
      .filter(([name]) => familyOf(ctx.data, name) === fam)
      .reduce((sum, [, stat]) => sum + (stat[1] ?? 0), 0)
    const clusterRank = clusters.length ? Math.min(...clusters.map((c) => c.rank)) : null
    let score = best ? Math.max(0, W.START_RANK_BASE - best.rank) * W.START_RANK_W : 0
    if (clusters.length) score += Math.max(0, W.START_COMP_BASE - clusterRank) * W.START_COMP_W + Math.log1p(clusters.length) * W.START_DIVERSITY_W
    // Az örnek tek başına güvenilir bir tercih oluşturmasın; popülerlik küçük bir ek puandır.
    if (best || clusters.length) score += Math.min(W.START_POP_CAP, Math.log1p(games) * W.START_POP_W)
    const rank = best?.rank ?? clusterRank
    return {
      score,
      rank,
      // Takım yok: meta sırası + meta dizilimde yer alma ek puanı
      pct: rank === null ? null : clampPct(metaPct(rank) + (clusters.length ? W.START_COMP_BONUS : 0)),
      reasons: [
        ...(best ? [rankReason(ctx, best, pkm)] : []),
        ...(clusters.length ? [T(ctx, "advice.inComps", { count: clusters.length, rank: clusterRank.toFixed(1) })] : [])
      ]
    }
  }

  // Sinerji adımı: "Su 2→3 (tamamlar)" ya da "Su 1→2 (eşik 3)" (İngilizcede "Water 2→3 (activates)")
  function synStep(ctx, syn, counts) {
    const count = counts[syn] ?? 0
    const next = ctx.thresholds?.[syn]?.find((step) => step > count)
    const step = T(ctx, "advice.synStep", { syn: displayName(ctx, "syn", syn), from: count, to: count + 1 })
    if (next === count + 1) return T(ctx, "advice.synActivates", { step })
    return next ? T(ctx, "advice.synThreshold", { step, next }) : step
  }

  function fitReasons(ctx, snap, reasons) {
    const counts = synergyCounts(ctx, snap)
    return reasons.map((r) => r.kind === "comp" ? T(ctx, "advice.inSuggestedComp") : synStep(ctx, r.syn, counts))
  }

  // ---------- 9) Yüzdeli uyum puanı (pct) ----------
  const clampPct = (value) => Math.max(0, Math.min(100, value))
  // Meta ortalama sırası → 0–100 doğrusal: 1. sıra 100, 4.5 sıra 50, 8. sıra 0
  const metaPct = (rank) => Number.isFinite(rank) ? clampPct(((8 - rank) / 7) * 100) : null
  const roundPct = (raw) => raw === null ? null : Math.round(clampPct(raw))
  // Pokémon: meta ağırlıklı; item: hemen kullanılabilmesi (takım) ağırlıklı.

  function tagFor(ctx, pct, meta, team) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    if (pct === null) return T(ctx, "advice.tag.noData")
    const strong = meta !== null && meta >= W.META_STRONG
    if (team >= W.TEAM_FIT && strong) return T(ctx, "advice.tag.metaTeam")
    if (team >= W.TEAM_FIT) return T(ctx, "advice.tag.teamFit")
    if (strong && pct >= W.TAG_PCT_MIN) return T(ctx, "advice.tag.metaStrong")
    return T(ctx, "advice.tag.weak")
  }

  // Ailenin toplam kopyası (yedek dahil) ve en üst yıldız için gereken kopya
  function familyCopies(ctx, snap, fam) {
    let owned = 0
    for (const unit of snap.board ?? []) {
      if (familyOf(ctx.data, unit.name) !== fam) continue
      owned += unit.stars >= 3 ? 9 : unit.stars === 2 ? 3 : 1
    }
    const stages = ctx.data.pokemons[fam]?.[5] ?? 3
    return { owned, needed: stages >= 3 ? 9 : stages === 2 ? 3 : 1 }
  }

  // Bir Pokémonun yüzdeli uyumu. reasons: [ağırlık, metin] — büyük ağırlık önce gösterilir.
  // teamless: başlangıç ya da tahtada kimse yok → yalnız meta.
  function livePokemonFit(ctx, snap, comps, pkm, teamless, planned = false) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const best = bestFamilyRank(ctx, pkm)
    const meta = metaPct(best?.rank)
    const reasons = best ? [[meta >= W.META_STRONG ? W.REASON_META_STRONG : W.REASON_META_WEAK, rankReason(ctx, best, pkm)]] : []
    if (teamless) return { meta, team: 0, raw: meta, reasons }
    const fam = familyOf(ctx.data, pkm)
    const onBoard = snap.board.filter((u) => u.y > 0 && !EMPTY.has(u.name))
    let syn = 0
    // Tahtada zaten bulunan aile sinerji sayacını yeniden artırmaz.
    if (!boardFamilies(ctx, snap).has(fam)) {
      const counts = synergyCounts(ctx, snap)
      for (const type of new Set(typesOf(ctx, pkm))) {
        const count = counts[type] ?? 0
        if (!count) continue
        const weight = ctx.thresholds?.[type]?.find((step) => step > count) === count + 1 ? W.SYN_NEXT_BONUS : W.SYN_BONUS
        syn += weight
        reasons.push([weight, synStep(ctx, type, counts)])
      }
    }
    let team = Math.min(W.SYN_CAP, syn)
    const { owned, needed } = familyCopies(ctx, snap, fam)
    if (!planned && owned > 0 && owned < needed) {
      team += W.COPY_BONUS
      reasons.push([W.COPY_BONUS, T(ctx, "advice.copy", { owned, needed })])
    }
    // Tahtandaki başka bir aileyle aynı meta dizilimin çekirdeğinde mi?
    for (const comp of comps) {
      const core = new Set(comp.core.map((p) => familyOf(ctx.data, p.name)))
      if (!core.has(fam) || !Number.isFinite(comp.cluster.rank)) continue
      const mate = onBoard.find((u) => familyOf(ctx.data, u.name) !== fam && core.has(familyOf(ctx.data, u.name)))
      if (!mate) continue
      team += W.COMP_BONUS
      reasons.push([W.COMP_BONUS, T(ctx, planned ? "advice.samePlanComp" : "advice.sameComp", { name: displayName(ctx, "pkm", mate.name), rank: comp.cluster.rank.toFixed(1) })])
      const names = [...comp.core]
        .sort((a, b) => b.frequency - a.frequency)
        .filter((p) => familyOf(ctx.data, p.name) !== fam)
        .slice(0, 3)
        .map((p) => displayName(ctx, "pkm", p.name))
      if (names.length) reasons.push([W.REASON_CORE, T(ctx, "advice.compCore", { names: names.join(", ") })])
      break
    }
    team = Math.min(100, team)
    const raw = meta === null && team === 0 ? null : W.PKM_META_W * (meta ?? W.UNKNOWN_META) + W.PKM_TEAM_W * team
    return { meta, team, raw, reasons }
  }

  function pokemonFit(ctx, snap, comps, pkm, teamless) {
    const W = { ...WEIGHTS, ...ctx.weights }
    const team = teamContext(ctx, snap)
    const live = livePokemonFit(ctx, snap, team.liveMatches, pkm, teamless && !team.planned.length)
    if (team.planWeight) {
      const future = livePokemonFit(ctx, team.future, team.futureMatches, pkm, false, true)
      if (team.planned.some((u) => familyOf(ctx.data, u.name) === familyOf(ctx.data, pkm))) {
        future.team = Math.min(100, future.team + W.PLAN_FAMILY_BONUS)
      }
      live.team = live.team * (1 - team.planWeight) + future.team * team.planWeight
      live.raw = live.meta === null && !live.team ? null : W.PKM_META_W * (live.meta ?? W.UNKNOWN_META) + W.PKM_TEAM_W * live.team
      live.reasons = [...live.reasons.map(([w, text]) => [w * (1 - team.planWeight), text]),
        ...future.reasons.map(([w, text]) => [w * team.planWeight, text])]
      if (future.team) live.reasons.push([W.PLAN_FAMILY_BONUS * team.planWeight, contextReason(ctx, team)])
    }
    if (live.team && live.reasons.length) {
      const top = live.reasons.reduce((a, b) => b[0] > a[0] ? b : a)
      const label = contextReason(ctx, team)
      if (!top[1].includes(label)) top[1] += ` · ${label}`
    }
    return live
  }

  function fitScore(ctx, snap, comps, pkm) {
    const W = { ...WEIGHTS, ...ctx.weights }
    const team = teamContext(ctx, snap)
    const live = liveFitScore(ctx, snap, team.liveMatches, pkm)
    if (team.planWeight) {
      const future = liveFitScore(ctx, team.future, team.futureMatches, pkm)
      if (team.planned.some((u) => familyOf(ctx.data, u.name) === familyOf(ctx.data, pkm))) future.score += W.PLAN_FAMILY_BONUS / 10
      live.score = live.score * (1 - team.planWeight) + future.score * team.planWeight
      if (contextKind(ctx, team) === "plan") live.reasons = future.reasons
    }
    if (live.reasons.length || team.planWeight) live.reasons.push({ kind: contextKind(ctx, team) })
    return live
  }

  const sortedReasons = (weighted) => [...new Map([...weighted]
    .sort((a, b) => b[0] - a[0])
    .map(([, text]) => [text, text])).keys()]
  const meanOrNull = (values) => {
    const known = values.filter((value) => value !== null)
    return known.length ? mean(known) : null
  }

  function pokemonChoiceScores(ctx, snap, choice, comps) {
    const W = { ...WEIGHTS, ...ctx.weights }
    const starter = choice.type === "starter" && !teamContext(ctx, snap).planned.length
    const teamless = starter || (!boardFamilies(ctx, snap).size && !teamContext(ctx, snap).planned.length)
    // Dükkan dizilim eşleşmesini şişirmesin: pct yalnız eldeki takıma bakar.
    const teamComps = suggestComps(ctx, { ...snap, shop: [] })
    return choice.pokemons.map((pkm, index) => {
      const members = ctx.data.duos[pkm] ?? [pkm]
      const fits = members.map((member) => {
        if (starter) {
          const s = starterScore(ctx, member)
          return { ...s, meta: s.pct, team: 0, raw: s.pct, weighted: s.reasons.map((text) => [1, text]) }
        }
        const fit = fitScore(ctx, snap, comps, member)
        const pf = pokemonFit(ctx, snap, teamComps, member, teamless)
        return { score: fit.score, rank: fit.best?.rank ?? null, meta: pf.meta, team: pf.team, raw: pf.raw, weighted: pf.reasons }
      })
      const bonus = bonusItem(ctx, choice.items?.[index])
      const ranks = fits.map((fit) => fit.rank).filter((rank) => rank !== null)
      // Başlangıçta sıra korunur; diğerlerinde en önemli gerekçe önce.
      const reasons = starter
        ? [...new Set(fits.flatMap((fit) => fit.weighted.map(([, text]) => text)))]
        : sortedReasons(fits.flatMap((fit) => fit.weighted))
      const rank = ranks.length ? mean(ranks) : null
      const memberRaw = meanOrNull(fits.map((fit) => fit.raw))
      const raw = memberRaw === null ? null : memberRaw + (bonus.rank === null ? 0 : metaPct(bonus.rank) * W.BONUS_META_W)
      const meta = meanOrNull(fits.map((fit) => fit.meta))
      const team = mean(fits.map((fit) => fit.team))
      if (!reasons.length) reasons.push(T(ctx, "advice.noMeta"))
      return {
        index,
        score: mean(fits.map((fit) => fit.score)) + bonus.score,
        raw,
        pct: roundPct(raw),
        tag: tagFor(ctx, roundPct(raw), meta, team),
        rank,
        hasData: raw !== null,
        reasons: bonus.reason ? [...reasons.slice(0, 2), bonus.reason] : reasons.slice(0, 3)
      }
    })
  }

  function itemChoiceScores(ctx, snap, choice) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const team = teamContext(ctx, snap)
    // Asalar taşıyıcıya takılmaz: tüm Peri birimlerine etki eder, yalnız meta sırasıyla puanlanır
    const fairies = team.units.filter((u) => u.y > 0 && (u.types ?? ctx.data.pokemons[u.name]?.[2] ?? []).includes("FAIRY")).length
    return (choice.items ?? []).map((item, index) => {
      if (/_WAND$/.test(item)) {
        const rank = itemMeta(ctx, item)
        const raw = metaPct(rank)
        const reasons = [T(ctx, "advice.wand", { n: fairies })]
        if (rank !== null) reasons.push(T(ctx, "advice.rank", { name: displayName(ctx, "item", item), rank: rank.toFixed(1) }))
        return { index, score: 0, raw, pct: roundPct(raw), tag: tagFor(ctx, roundPct(raw), raw, 0), rank,
          hasData: raw !== null, canAvoid: false, reasons }
      }
      const fit = itemHolderFit(ctx, team, item)
      const rank = itemMeta(ctx, item)
      const usable = Boolean(fit.holder && !fit.partial)
      const score = usable ? fit.score : 0
      const reasons = usable ? [...fit.reasons] : []
      if (usable && rank !== null) reasons.push(T(ctx, "advice.rank", { name: displayName(ctx, "item", item), rank: rank.toFixed(1) }))
      if (!reasons.length && !Array.isArray(snap.inventory) && ctx.data.components?.includes(item)) {
        reasons.push(T(ctx, "advice.noInventory"))
      }
      const meta = metaPct(itemMeta(ctx, usable ? fit.result ?? item : item))
      const raw = score ? W.ITEM_TEAM_W * score + W.ITEM_META_W * (meta ?? W.UNKNOWN_ITEM_META)
        : meta === null ? null : W.ITEM_META_W * meta
      return { index, score: score / 10, raw, pct: roundPct(raw),
        tag: tagFor(ctx, roundPct(raw), meta, score), rank,
        hasData: usable, canAvoid: usable,
        reasons: reasons.length ? reasons.slice(0, 3) : [T(ctx, "advice.noUse")] }
    })
  }

  // Kararlar pct ile tutarlı: best en yüksek pct; good en fazla 10 puan geride;
  // avoid için pct ≤ 40 VE best'ten ≥ 25 puan düşük (veri yoksa 0 sayılır).
  function choiceVerdicts(ctx, scored) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const known = scored.filter((option) => option.raw !== null)
    const best = known.reduce((top, option) => !top || option.raw > top.raw ? option : top, null)
    const tied = scored.length > 1 && known.length === scored.length &&
      scored.every((option) => Math.abs(option.raw - best.raw) < 1e-9)
    const hasData = best !== null && scored.some((option) => option.hasData)
    return scored.map((option) => {
      const pct = option.pct ?? 0
      const gap = hasData ? best.pct - pct : 0
      let verdict = "neutral"
      if (hasData && !tied) {
        if (option === best) verdict = "best"
        else if (option.pct !== null && gap <= W.GOOD_GAP) verdict = "good"
        else if (gap >= W.AVOID_GAP && pct <= W.AVOID_MAX && option.canAvoid !== false) verdict = "avoid"
      }
      return {
        index: option.index,
        verdict,
        label: verdictLabel(ctx, verdict),
        reasons: option.reasons,
        score: option.score,
        pct: option.pct,
        tag: option.tag
      }
    })
  }

  // ---------- 10) Item birleştirme planı ----------
  // Eldeki parçalarla yapılabilen, sahadaki (y>0) bir taşıyıcının istediği/popüler itemler; açgözlü (en yüksek pct önce), her parça tek tarifte kullanılır.
  function craftPlan(ctx, snap) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    const inventory = Array.isArray(snap.inventory) ? snap.inventory.filter((item) => !EMPTY.has(item)) : []
    if (!inventory.length) return []
    const team = teamContext(ctx, snap)
    const pairs = []
    const wanted = new Set(team.units.filter((u) => u.y > 0).flatMap((u) => holderWants(ctx, u.name)))
    for (const item of wanted) {
      const recipe = ctx.data.recipes?.[item]
      if (!recipe || craftStatus(ctx, item, inventory).state !== "craftable") continue
      const fit = itemHolderFit(ctx, liveHolders(team), item)
      if (!fit.holder || fit.future || !(fit.holder.y > 0)) continue
      const unit = fit.holder
      const targetIndex = team.units.indexOf(unit)
      const order = Math.max(0, plannerItems(ctx, unit.name).indexOf(item))
      const rank = itemMeta(ctx, item)
      const raw = W.CRAFT_ORDER_W * (100 - order * W.CRAFT_ORDER_PENALTY) +
        W.CRAFT_META_W * (metaPct(rank) ?? W.UNKNOWN_ITEM_META) + W.CRAFT_STAR_W * ((unit.stars ?? 1) - 1)
      const blended = raw * (1 - W.CRAFT_HOLDER_W) + W.CRAFT_HOLDER_W * fit.score
      pairs.push({ item, recipe, unit, targetIndex, raw: blended, rank, order })
    }
    pairs.sort((a, b) => b.raw - a.raw || (b.unit.stars ?? 1) - (a.unit.stars ?? 1) || a.targetIndex - b.targetIndex)
    const left = countBy(inventory)
    const planned = new Map() // hedef indeksi → bu planda verilecek itemler
    const out = []
    for (const p of pairs) {
      const need = countBy(p.recipe)
      if ([...need].some(([comp, n]) => (left.get(comp) ?? 0) < n)) continue
      const given = planned.get(p.targetIndex) ?? []
      if (given.includes(p.item) || (p.unit.items ?? []).length + given.length >= 3) continue
      for (const [comp, n] of need) left.set(comp, left.get(comp) - n)
      planned.set(p.targetIndex, [...given, p.item])
      const target = displayName(ctx, "pkm", p.unit.name)
      out.push({
        item: p.item,
        components: [...p.recipe],
        target: p.unit.name,
        targetIndex: p.targetIndex,
        pct: roundPct(p.raw),
        reason: p.rank !== null
          ? T(ctx, "advice.craftMeta", { target, rank: p.rank.toFixed(1) })
          : T(ctx, "advice.craftOrder", { target, n: p.order + 1 })
      })
    }
    return out
  }

  function boardAdvice(ctx, snap) {
    const comps = suggestComps(ctx, snap)
    const current = snap.choices?.[0]
    const kind = current?.pokemons?.length ? "pokemon" : "item"
    const choice = current ? {
      id: current.id,
      type: current.type,
      kind,
      options: choiceVerdicts(ctx, kind === "pokemon"
        ? pokemonChoiceScores(ctx, snap, current, comps)
        : itemChoiceScores(ctx, snap, current))
    } : null
    const existing = new Map(shopAdvice(ctx, snap).map((s) => [s.slot, s.reasons]))
    const teamless = !boardFamilies(ctx, snap).size && !teamContext(ctx, snap).planned.length
    const teamComps = suggestComps(ctx, { ...snap, shop: [] })
    const shop = snap.shop.map((pkm, index) => ({ pkm, index }))
      .filter(({ pkm }) => !EMPTY.has(pkm))
      .map(({ pkm, index }) => {
        const reasons = existing.get(index) ?? []
        const verdict = reasons.length ? "good" : "neutral"
        // Seçim kartlarıyla aynı ölçek; verdict "good" olmasa da puan verilir.
        const fit = pokemonFit(ctx, snap, teamComps, pkm, teamless)
        const pct = roundPct(fit.raw)
        return { index, verdict, label: verdictLabel(ctx, verdict), reasons, pct, tag: tagFor(ctx, pct, fit.meta, fit.team) }
      })
    return { choice, shop, craft: craftPlan(ctx, snap) }
  }

  // ---------- 10) Takım planlayıcısı (DOM ve canlı oyun durumundan bağımsız) ----------
  function plannerContext(ctx) {
    if (!ctx?.data?.pokemons || typeof ctx.data.pokemons !== "object") return null
    return {
      ...ctx,
      data: ctx.data,
      tierPokemons: ctx.tierPokemons ?? {},
      clusters: Array.isArray(ctx.clusters) ? ctx.clusters : [],
      minGames: Number.isFinite(ctx.minGames) ? Math.max(0, ctx.minGames) : 20
    }
  }

  const plannerUnits = (plan) => Array.isArray(plan)
    ? plan.filter((p) => p && typeof p.name === "string" && !EMPTY.has(p.name)) : []
  const plannerHeld = (items) => Array.isArray(items) ? items.filter((it) => typeof it === "string" && !EMPTY.has(it)) : []

  const plannerCoreCache = new WeakMap()
  function plannerCore(ctx, cluster) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    if (!cluster || typeof cluster !== "object") return []
    let byData = plannerCoreCache.get(cluster)
    if (!byData) plannerCoreCache.set(cluster, (byData = new WeakMap()))
    let byFrequency = byData.get(ctx.data)
    if (!byFrequency) byData.set(ctx.data, (byFrequency = new Map()))
    if (byFrequency.has(W.PLANNER_CORE_MIN)) return byFrequency.get(W.PLANNER_CORE_MIN)
    const families = new Map()
    for (const p of Array.isArray(cluster?.pokemons) ? cluster.pokemons : []) {
      if (!p || EMPTY.has(p.name) || !ctx.data.pokemons[p.name] || !Number.isFinite(p.frequency) || p.frequency < W.PLANNER_CORE_MIN) continue
      const fam = familyOf(ctx.data, p.name)
      const prior = families.get(fam)
      // Aynı ailenin farklı formları tek hedef, frekansları toplam ağırlıktır.
      families.set(fam, {
        name: !prior || p.frequency > prior.frequency ? p.name : prior.name,
        frequency: Math.max(p.frequency, prior?.frequency ?? 0),
        weight: (prior?.weight ?? 0) + p.frequency
      })
    }
    const core = [...families.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    byFrequency.set(W.PLANNER_CORE_MIN, core)
    return core
  }

  function plannerSynergies(ctx, units) {
    const families = new Map()
    for (const unit of units) {
      if (!(unit.y >= 1)) continue
      const fam = familyOf(ctx.data, unit.name)
      const types = families.get(fam) ?? new Set()
      for (const type of typesOf(ctx, unit.name)) types.add(type)
      // İsteğe bağlı statik eşleme: itemTypes[item] = tür veya tür dizisi.
      for (const item of plannerHeld(unit.items)) {
        const bonus = ctx.data.itemTypes?.[item]
        for (const type of Array.isArray(bonus) ? bonus : typeof bonus === "string" ? [bonus] : []) types.add(type)
      }
      families.set(fam, types)
    }
    const counts = new Map()
    for (const types of families.values()) {
      for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return [...counts].map(([syn, count]) => {
      const steps = Array.isArray(ctx.thresholds?.[syn]) ? ctx.thresholds[syn].filter(Number.isFinite) : []
      const next = steps.filter((n) => n > count).sort((a, b) => a - b)[0] ?? null
      return { syn, count, next, need: next === null ? 0 : next - count }
    }).sort((a, b) => (a.need || Infinity) - (b.need || Infinity) || b.count - a.count || a.syn.localeCompare(b.syn))
  }

  function planFit(ctx, plan) {
    const empty = { best: [], synergies: [], missing: [] }
    ctx = plannerContext(ctx)
    if (!ctx || !Array.isArray(plan)) return empty
    const units = plannerUnits(plan)
    const mine = new Set(units.map((p) => familyOf(ctx.data, p.name)))
    const best = []
    for (const cluster of ctx.clusters) {
      if (!cluster || !(cluster.count >= ctx.minGames)) continue
      const core = plannerCore(ctx, cluster)
      if (!core.length) continue
      const owned = core.filter((p) => mine.has(familyOf(ctx.data, p.name)))
      const missing = core.filter((p) => !mine.has(familyOf(ctx.data, p.name)))
      const total = core.reduce((sum, p) => sum + p.weight, 0)
      best.push({ cluster, fit: roundPct(100 * owned.reduce((sum, p) => sum + p.weight, 0) / total),
        owned: owned.map((p) => p.name), missing: missing.map((p) => p.name) })
    }
    best.sort((a, b) => b.fit - a.fit || (a.cluster.rank ?? 8) - (b.cluster.rank ?? 8) || b.cluster.count - a.cluster.count)
    // Eksikler en iyi dizilimindir; alternatif dizilimler birbirine karıştırılmaz.
    return { best: best.slice(0, 3), synergies: plannerSynergies(ctx, units),
      missing: (best[0]?.missing ?? []).map((pkm) => ({ pkm, why: "comp" })) }
  }

  function planRecommendations(ctx, plan, options = {}) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    ctx = plannerContext(ctx)
    if (!ctx || !Array.isArray(plan)) return []
    const limit = options?.limit ?? 10
    if (!Number.isFinite(limit) || limit <= 0) return []
    const mine = new Set(plannerUnits(plan).map((p) => familyOf(ctx.data, p.name)))
    const team = teamContext(ctx, options.snap ?? ctx.snap ?? { board: plannerUnits(plan), shop: [] }, plan)
    const sources = [[planFit(ctx, team.units), 1 - team.planWeight], [planFit(ctx, team.planned), team.planWeight]]
    const fit = { best: sources.flatMap(([f, weight], source) => f.best.map((entry) => ({ ...entry, weight, source }))),
      synergies: sources.flatMap(([f, weight]) => f.synergies.map((entry) => ({ ...entry, weight }))) }
    const candidates = new Map()
    const add = (pkm) => {
      const fam = familyOf(ctx.data, pkm)
      if (mine.has(fam)) return
      if (!candidates.has(fam)) candidates.set(fam, pkm)
    }
    for (const entry of fit.best) for (const pkm of entry.missing) add(pkm)
    const rarities = ctx.data.rules?.shopRarities ?? ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA"]
    for (const [pkm, d] of Object.entries(ctx.data.pokemons)) {
      if (!Array.isArray(d) || d[1] !== 1 || d[3] || d[4] || !d[6] || !rarities.includes(d[0])) continue
      if (fit.synergies.some((s) => s.need > 0 && typesOf(ctx, pkm).includes(s.syn))) add(pkm)
    }
    return [...candidates.values()].map((pkm) => {
      const reasons = []
      const fam = familyOf(ctx.data, pkm)
      let comp = 0
      const compBySource = new Map()
      for (const entry of fit.best) {
        const core = plannerCore(ctx, entry.cluster)
        const member = core.find((p) => familyOf(ctx.data, p.name) === fam)
        if (member) compBySource.set(entry.source, Math.max(compBySource.get(entry.source) ?? 0,
          Math.min(1, member.weight) * (W.PLANNER_COMP_BASE + entry.fit / 200) * entry.weight))
      }
      comp = [...compBySource.values()].reduce((sum, value) => sum + value, 0)
      if (comp) reasons.push({ kind: "comp" })
      let synergy = 0
      for (const s of fit.synergies) {
        if (!s.need || !typesOf(ctx, pkm).includes(s.syn)) continue
        synergy += s.weight / s.need
        reasons.push({ kind: s.need === 1 ? "next" : "syn", syn: s.syn })
      }
      const best = bestFamilyRank(ctx, pkm)
      const meta = metaPct(best?.rank) ?? 0
      if (best && Number.isFinite(best.rank)) reasons.push({ kind: "meta" })
      // Sabit ölçek: dizilim %50, eşik yakınlığı %30, meta ortalama sırası %20.
      // Aday kümesi değişince aynı Pokémonun yüzdesi değişmez.
      reasons.push({ kind: contextKind(ctx, team) })
      return { pkm, fit: roundPct(W.PLANNER_COMP_W * comp + W.PLANNER_SYN_W * Math.min(1, synergy) + W.PLANNER_META_W * meta),
        reasons: uniqueReasons(reasons), rarity: ctx.data.pokemons[pkm]?.[0] ?? null }
    }).sort((a, b) => b.fit - a.fit || a.pkm.localeCompare(b.pkm)).slice(0, Math.floor(limit))
  }

  function plannerItems(ctx, pkm) {
    const source = statFor(ctx, pkm)
    return plannerHeld(source?.stat[3]).slice(0, 3)
  }

  function planItems(ctx, plan) {
    ctx = plannerContext(ctx)
    if (!ctx || !Array.isArray(plan) || !Object.keys(ctx.tierPokemons).length) return []
    return plannerUnits(plan).map((unit) => ({ pkm: unit.name, items: plannerItems(ctx, unit.name), have: plannerHeld(unit.items) }))
  }

  function plannerFinalForm(ctx, pkm) {
    const chain = familyChain(ctx.data, pkm).filter((name) => ctx.data.pokemons[name])
    const stars = (name) => ctx.data.pokemons[name][1] ?? 0
    const highest = Math.max(...chain.map(stars))
    // Önce son evrim; dallanmış son formlar arasında meta oyun sayısı belirleyicidir.
    return chain.filter((name) => stars(name) === highest)
      .sort((a, b) => (ctx.tierPokemons[b]?.[1] ?? 0) - (ctx.tierPokemons[a]?.[1] ?? 0) ||
        (b === pkm) - (a === pkm) || a.localeCompare(b))[0] ?? pkm
  }

  function plannerFront(ctx, pkm) {
    // İsteğe bağlı statik alan: pokemonStats[name] = {hp, def, range}.
    const stats = ctx.data.pokemonStats?.[pkm]
    if (stats) return stats.range === 1 || stats.hp >= 200 || stats.def >= 30
    // Mevcut kompakt veri savaş istatistiği taşımıyor; savunmacı türler yaklaşık ön saftır.
    return typesOf(ctx, pkm).some((type) => ["ROCK", "STEEL", "GROUND", "MONSTER", "FIGHTING"].includes(type))
  }

  function compToPlan(ctx, cluster, options = {}) {
    ctx = plannerContext(ctx)
    if (!ctx || !cluster) return []
    const keep = options?.keepPlan
    if (keep != null && !Array.isArray(keep)) return []
    const out = []
    const occupied = new Set()
    for (const unit of keep ?? []) {
      if (!unit || EMPTY.has(unit.name) || !ctx.data.pokemons[unit.name] ||
        !Number.isInteger(unit.x) || unit.x < 0 || unit.x > 7 ||
        !Number.isInteger(unit.y) || unit.y < 1 || unit.y > 3 ||
        !Array.isArray(unit.items) || unit.items.length > 3 || plannerHeld(unit.items).length !== unit.items.length ||
        occupied.has(`${unit.x},${unit.y}`)) return []
      occupied.add(`${unit.x},${unit.y}`)
      out.push({ ...unit, items: [...unit.items] })
    }
    const mine = new Set(out.map((p) => familyOf(ctx.data, p.name)))
    const additions = plannerCore(ctx, cluster).slice(0, 8)
      .filter((p) => !mine.has(familyOf(ctx.data, p.name)))
      .map((p) => plannerFinalForm(ctx, p.name))
    for (const front of [true, false]) {
      const group = additions.filter((pkm) => plannerFront(ctx, pkm) === front)
      // Oyunda y=3 rakibe en yakın sıradır (simulation: mavi takım y-1, kırmızı 5-(y-1)).
      const rows = front ? [3, 2, 1] : [2, 1]
      // Yeni dizilimde her saf kendi içinde ortalanır; mevcut planda merkeze en yakın boş kare seçilir.
      const xs = keep == null
        ? Array.from({ length: 8 }, (_, i) => (Math.floor((8 - group.length) / 2) + i) % 8)
        : [3, 4, 2, 5, 1, 6, 0, 7]
      const squares = rows.flatMap((y) => xs.map((x) => ({ x, y })))
      for (const pkm of group) {
        const square = squares.find(({ x, y }) => !occupied.has(`${x},${y}`))
        if (!square) break
        occupied.add(`${square.x},${square.y}`)
        out.push({ name: pkm, ...square, items: plannerItems(ctx, pkm) })
      }
    }
    return out
  }

  // ---------- 11) Canlı ortak seçim ve bölge portalları ----------
  // Eksik meta ve snapshot alanları eski önbelleklerde normaldir; ortak yardımcılar
  // için varsayılanları burada tamamla, çağıranın verisini değiştirme.
  function carouselContext(ctx) {
    ctx = plannerContext(ctx)
    return ctx
  }

  const uniqueReasons = (reasons) => [...new Map(reasons.map((r) => [JSON.stringify(r), r])).values()]
  const availableFirst = (a, b) => Number(a.taken) - Number(b.taken) || b.score - a.score

  function rankCarousel(ctx, snap, plan = ctx?.plan ?? EMPTY_PLAN) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    ctx = carouselContext(ctx)
    if (!ctx || snap?.carousel?.kind !== "items" || !Array.isArray(snap.carousel.items)) return []
    ctx = { ...ctx, plan }
    const team = teamContext(ctx, snap, plan)
    const comp = suggestComps(ctx, { ...snap, board: team.units, shop: [] })[0]?.cluster
    return snap.carousel.items.filter((it) => it && typeof it.name === "string" && !EMPTY.has(it.name)).map((it) => {
      const fit = itemHolderFit(ctx, team, it.name)
      let score = fit.score
      const reasons = fit.holder ? [{ kind: fit.partial ? (fit.future ? "want" : "component") : fit.result ? "craft" : "want",
        pkm: fit.holder.name, item: fit.partial ? fit.result : fit.result ? fit.other : it.name },
        { kind: contextKind(ctx, team) }] : []
      for (const entry of comp?.items ?? []) {
        const item = typeof entry === "string" ? entry : entry?.item
        if (item && (item === it.name || ctx.data.recipes?.[item]?.includes(it.name))) {
          // Dizilim tek başına taşıyıcı varmış gibi güçlü bir öneri üretmez.
          score = Math.max(score, W.CAROUSEL_COMP_BONUS * (1 - team.planWeight))
          reasons.push({ kind: "comp", item })
        }
      }
      return { item: it.name, taken: !!it.taken, score: roundPct(score), reasons: uniqueReasons(reasons) }
    }).sort(availableFirst)
  }

  // Bölgenin havuzu (bölgesel bayraklı ve bölge türünden Pokémonlar) veri değişmedikçe sabittir
  const poolCache = new WeakMap()
  function regionalPool(ctx, map, regionTypes) {
    let pools = poolCache.get(ctx.data)
    if (!pools) poolCache.set(ctx.data, (pools = new Map()))
    if (!pools.has(map)) pools.set(map, Object.entries(ctx.data.pokemons)
      .filter(([pkm, d]) => Array.isArray(d) && d[4] && typesOf(ctx, pkm).some((syn) => regionTypes.includes(syn)))
      .map(([pkm]) => pkm))
    return pools.get(map)
  }

  function rankPortals(ctx, snap, plan = ctx?.plan ?? EMPTY_PLAN) {
    const W = { ...WEIGHTS, ...ctx?.weights }
    ctx = carouselContext(ctx)
    if (!ctx || snap?.carousel?.kind !== "portals" || !Array.isArray(snap.carousel.portals)) return []
    ctx = { ...ctx, plan }
    const team = teamContext(ctx, snap, plan)
    const counts = team.liveSynergies
    const plannedCounts = team.plannedSynergies
    const comps = suggestComps(ctx, { ...snap, board: team.units, shop: [] })
    // Portallar türleri paylaşır: aynı Pokémonun takım uyumu bu çağrıda bir kez hesaplanır
    const fits = new Map()
    const regionalFit = (pkm) => {
      if (!fits.has(pkm)) fits.set(pkm, roundPct(fitScore(ctx, snap, comps, pkm).score * 10))
      return fits.get(pkm)
    }
    // Aktif sinerji ve sonraki eşiğe bir birim kalan sinerji önceliklidir.
    const affinity = (syn, n) => {
      const steps = Array.isArray(ctx.thresholds?.[syn]) ? ctx.thresholds[syn] : []
      if (!n || !steps.length) return 0
      const active = steps.some((step) => step <= n)
      const near = steps.find((step) => step > n) === n + 1
      return (active ? W.PORTAL_ACTIVE_BONUS : 0) + (near ? W.PORTAL_NEAR_BONUS : 0)
    }
    return snap.carousel.portals.filter((p) => p && typeof p.id === "string" && typeof p.map === "string").map((p) => {
      const synergies = [...new Set(plannerHeld(p.synergies))]
      const regionTypes = plannerHeld(ctx.data.regions?.[p.map])
      const reasons = []
      let synScore = 0
      // Bölge türleri kalıcı havuzu, canlı semboller portalın ek sinerjilerini temsil eder.
      for (const syn of new Set([...regionTypes, ...synergies])) {
        const live = affinity(syn, counts[syn])
        const planned = affinity(syn, plannedCounts[syn])
        synScore += live * (1 - team.planWeight) + planned * team.planWeight
        if (live) reasons.push({ kind: "syn", syn })
        if (planned && team.planWeight) reasons.push({ kind: "plan", syn })
      }
      // Bölgesel havuz sabit bölge türlerinden çıkar; canlı semboller geçici bonuslar da taşıyabilir.
      const families = new Map()
      for (const pkm of regionalPool(ctx, p.map, regionTypes)) {
        const fit = regionalFit(pkm)
        const family = familyOf(ctx.data, pkm)
        const prior = families.get(family)
        if (!prior || fit > prior.fit) families.set(family, { pkm, fit })
      }
      const regional = [...families.values()].sort((a, b) => b.fit - a.fit || a.pkm.localeCompare(b.pkm)).slice(0, 3)
      for (const r of regional) {
        if (r.fit > 0) reasons.push({ kind: "regional", pkm: r.pkm })
        if (team.planned.some((u) => familyOf(ctx.data, u.name) === familyOf(ctx.data, r.pkm))) {
          reasons.push({ kind: "plan", pkm: r.pkm })
        }
      }
      const stat = ctx.regionsMeta?.[p.map]
      const meta = Array.isArray(stat) && Number.isFinite(stat[0]) && Number.isFinite(stat[1]) && stat[1] >= ctx.minGames
        ? { rank: stat[0], count: stat[1] } : null
      if (meta) reasons.push({ kind: "meta" })
      // Sabit ölçek: sinerji en fazla 50, en iyi bölgesel uyum 30, bölge metası 20 puan.
      const score = roundPct(Math.min(W.PORTAL_SYN_CAP, synScore) + (regional[0]?.fit ?? 0) * W.PORTAL_REGIONAL_W + (meta ? metaPct(meta.rank) * W.PORTAL_META_W : 0))
      if (synScore || regional.some((r) => r.fit > 0)) reasons.push({ kind: contextKind(ctx, team) })
      return { portalId: p.id, map: p.map, taken: !!p.taken, score, synergies, regional, meta, reasons: uniqueReasons(reasons) }
    }).sort(availableFirst)
  }

  window.PacAdvisor = {
    WEIGHTS,
    buildContext,
    teamContext,
    itemHolderFit,
    rankCarousel,
    rankPortals,
    planFit,
    planRecommendations,
    planItems,
    compToPlan,
    boardAdvice,
    familyChain,
    analyze(ctx, snap) {
      const inventory = snap.inventory
      const comps = suggestComps(ctx, snap)
      const items = suggestItems(ctx, snap, inventory)
      return {
        comps,
        items,
        craft: craftNow(ctx, items, inventory),
        propositions: rankPropositions(ctx, snap, items),
        pokemonPropositions: rankPokemonPropositions(ctx, snap, comps),
        shop: shopAdvice(ctx, snap),
        synergies: synergyTracker(ctx, snap),
        economy: economy(ctx, snap),
        pool: poolOdds(ctx, snap, comps),
        opponent: opponentSummary(ctx, snap),
        regional: regionalAdvice(ctx, snap, comps),
        mineFamilies: new Set(snap.board.map((p) => familyOf(ctx.data, p.name))),
        familyOf: (p) => familyOf(ctx.data, p)
      }
    },
    summarize: gameSummary
  }
})()
