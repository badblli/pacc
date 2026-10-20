// Planlayıcı koçu yalnızca kendi gölge ağacını çizer; oyunla köprü mesajları üzerinden konuşur.
;(() => {
  if (document.getElementById("pac-planner")) return
  const I18n = window.PacI18n
  const t = (key, vars) => I18n.t(key, vars)
  const esc = (s) => I18n.escapeHtml(s)
  const state = {
    planner: { open: false, board: [], rects: null }, game: null,
    settings: { planner: true, tier: "LEVEL_BALL", minGames: 50 },
    meta: null, data: null, text: null, recommended: false, summary: false,
    chooser: false, selected: null, filter: "", minimized: false, notice: "", pending: null
  }
  const host = document.createElement("div")
  host.id = "pac-planner"
  // Planlayıcı açıkken host oyunun modal <dialog>'unun İÇİNE taşınır: modal açıkken tarayıcı
  // dialog dışındaki her şeyi tıklanamaz (inert) yapar, popover üstte görünse bile tıklanmaz.
  const root = host.attachShadow({ mode: "open" })
  function mountHost(open) {
    const dialog = open ? document.querySelector("dialog.modal.team-builder-modal[open]") : null
    const parent = dialog ?? document.documentElement
    if (host.parentNode !== parent) parent.appendChild(host)
    return Boolean(dialog)
  }
  root.innerHTML = '<style></style><div id="surface"></div>'
  document.documentElement.appendChild(host)
  const surface = root.getElementById("surface")
  const name = (key, kind = "pkm") => state.text?.[kind]?.[key] ?? I18n.humanize(key)
  const family = (key) => state.data?.family?.[key] ?? key
  const title = (cluster) => Object.entries(cluster?.synergies ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([syn, n]) => `${name(syn, "synergy")} ${n}`).join(" / ") || t("panel.comp.fallback")
  const ctx = () => ({
    data: state.data, tierPokemons: state.meta?.pokemons?.[state.settings.tier] ?? {},
    tierItems: state.meta?.items?.[state.settings.tier] ?? {}, clusters: state.meta?.clusters ?? [],
    minGames: state.settings.minGames, thresholds: state.meta?.thresholds ?? null,
    names: { pkm: name, syn: (k) => name(k, "synergy"), item: (k) => name(k, "item") }, t
  })
  const advice = (method, fallback, ...args) => {
    try { return window.PacAdvisor?.[method]?.(ctx(), ...args) ?? fallback } catch { return fallback }
  }
  const button = (action, label, attrs = "") => `<button type="button" data-action="${action}" ${attrs}>${esc(label)}</button>`
  const portrait = (key, owned = false) => {
    const idx = state.data?.pkmIndex?.[key]
    return `<span class="portrait${owned ? " owned" : ""}" title="${esc(name(key))}">${idx
      ? `<img src="/assets/portraits/${esc(String(idx).replace("-", "/"))}/Normal.png" alt="" loading="lazy">` : "◇"}</span>`
  }
  const item = (key) => `<span class="item" title="${esc(name(key, "item"))}"><img src="/assets/item/${esc(key)}.png" alt="${esc(name(key, "item"))}"></span>`
  const empty = () => `<p class="empty">${esc(t("panel.planner.empty"))}</p>`
  const disabled = () => state.pending ? "disabled" : ""
  const reason = (r) => r.kind === "next" ? t("panel.reason.next", { syn: name(r.syn, "synergy") })
    : r.kind === "syn" ? t("panel.reason.syn", { syn: name(r.syn, "synergy") })
      : r.kind === "meta" ? t("panel.planner.metaReason") : t("panel.reason.comp")

  function recommendations(plan) {
    const list = advice("planRecommendations", [], plan, { limit: 10 })
    return `<div class="recommendations">${list.map((p) => `<button type="button" class="recommendation" data-add="${esc(p.pkm)}" ${disabled()}>
      ${portrait(p.pkm)}<span class="unit-text"><b>${esc(name(p.pkm))}</b><small>${esc(I18n.has(`rarity.${p.rarity}`) ? t(`rarity.${p.rarity}`) : I18n.humanize(p.rarity))}</small>
      <small>${esc((p.reasons ?? []).map(reason).join(" · "))}</small></span>
      <span class="fit">${esc(t("panel.planner.fit", { n: p.fit }))}<small>${esc(t("panel.planner.add"))} +</small></span></button>`).join("") || empty()}</div>`
  }

  function summary(plan, fit) {
    const best = fit.best?.[0]
    return `${button("summary", `★ ${best ? t("panel.planner.fit", { n: best.fit }) : t("panel.planner.coach")}`, `aria-expanded="${state.summary}" aria-controls="coach-details"`)}
      ${state.summary ? `<div id="coach-details" class="details"><b>${esc(best ? title(best.cluster) : t("panel.planner.coach"))}</b>
        <h3>${esc(t("panel.planner.missing"))}</h3>${(fit.missing ?? []).map((p) => `<div class="unit-line">${portrait(p.pkm)}<span>${esc(name(p.pkm))}</span>${button("add", t("panel.planner.add"), `data-add="${esc(p.pkm)}" ${disabled()}`)}</div>`).join("") || empty()}
        <h3>${esc(t("panel.planner.items"))}</h3>${advice("planItems", [], plan).map((p) => `<div class="unit-line">${portrait(p.pkm)}<span>${esc(name(p.pkm))}</span><span>${p.items.map(item).join("")}</span></div>`).join("") || empty()}</div>` : ""}`
  }

  function chooser(plan) {
    const clusters = (state.meta?.clusters ?? []).filter((c) => c.count >= state.settings.minGames).sort((a, b) => a.rank - b.rank)
    const filters = [...new Set(clusters.flatMap((c) => Object.keys(c.synergies ?? {})))].sort()
    const visible = clusters.filter((c) => !state.filter || c.synergies?.[state.filter])
    const selected = visible.find((c) => c.id === state.selected) ?? visible[0]
    state.selected = selected?.id ?? null
    const families = new Set(plan.map((p) => family(p.name)))
    const core = (c) => [...(c.pokemons ?? [])].sort((a, b) => b.frequency - a.frequency).slice(0, 8)
    const preview = selected ? advice("compToPlan", [], selected, {}) : []
    return `<div class="veil"><section class="chooser card" role="dialog" aria-modal="true" aria-labelledby="chooser-title">
      <header><div><small>${esc(t("panel.planner.eyebrow"))}</small><h2 id="chooser-title">${esc(t("panel.planner.start"))}</h2></div>${button("close", t("panel.close"))}</header>
      <div class="filters" role="group" aria-label="${esc(t("panel.planner.filters"))}">${button("filter", t("panel.planner.all"), `data-filter="" aria-pressed="${!state.filter}"`)}${filters.map((s) => button("filter", name(s, "synergy"), `data-filter="${esc(s)}" aria-pressed="${state.filter === s}"`)).join("")}</div>
      <div class="chooser-columns"><div class="comps">${visible.map((c) => `<button class="comp" data-cluster="${esc(c.id)}" aria-pressed="${selected?.id === c.id}"><b>${esc(title(c))}</b>
        <span class="metrics">${esc(t("panel.planner.metrics", { rank: Number(c.rank).toFixed(2), win: c.winrate, games: I18n.number(c.count) }))}</span>
        <span class="core">${core(c).map((p) => portrait(p.name, families.has(family(p.name)))).join("")}</span></button>`).join("") || empty()}</div>
      <aside class="preview"><h3>${esc(t("panel.planner.preview"))}</h3><b>${esc(selected ? title(selected) : t("panel.planner.coach"))}</b>
        <div class="mini-board" aria-label="${esc(t("panel.planner.preview"))}">${Array.from({ length: 24 }, (_, i) => {
          // Oyunun planlayıcısı gibi ön sıra (y=3) üstte
          const p = preview.find((p) => p.x === i % 8 && p.y === 3 - Math.floor(i / 8))
          return `<span>${p ? portrait(p.name, families.has(family(p.name))) : ""}</span>`
        }).join("")}</div><small class="planned">○ ${esc(t("panel.planner.inPlan"))}</small>
        ${button("replace", t("panel.planner.replace"), `class="primary" ${!preview.length || state.pending ? "disabled" : ""}`)}
        ${button("merge", t("panel.planner.merge"), !preview.length || state.pending ? "disabled" : "")}
      </aside></div></section></div>`
  }

  function nextSteps(plan, items) {
    if (!state.game) return []
    const wanted = new Set(plan.map((p) => family(p.name)))
    const board = state.game.board ?? []
    const steps = []
    for (const pkm of new Set(state.game.shop ?? [])) {
      if (!wanted.has(family(pkm))) continue
      const copies = board.filter((p) => family(p.name) === family(pkm))
      const target = plan.find((p) => family(p.name) === family(pkm))
      if (copies.some((p) => p.name === target.name)) continue
      steps.push(t(copies.length ? "panel.planner.copy" : "panel.planner.buy", { name: name(pkm) }))
    }
    for (const p of items) {
      for (const key of p.items) {
        const owned = board.find((b) => family(b.name) === family(p.pkm))
        if (!owned || owned.items?.includes(key)) continue
        const inv = [...(state.game.inventory ?? [])]
        const recipe = state.data?.recipes?.[key]
        const craftable = recipe?.every((part) => {
          const i = inv.indexOf(part)
          if (i < 0) return false
          inv.splice(i, 1)
          return true
        })
        if (state.game.inventory?.includes(key) || craftable) steps.push(t("panel.planner.equip", { item: name(key, "item"), name: name(p.pkm) }))
      }
    }
    return [...new Set(steps)].slice(0, 3)
  }

  function tracker(plan, fit) {
    const owned = new Set((state.game?.board ?? []).map((p) => family(p.name)))
    const planned = new Set(plan.map((p) => family(p.name)))
    const count = [...planned].filter((f) => owned.has(f)).length
    const steps = nextSteps(plan, advice("planItems", [], plan))
    return `<section class="tracker card"><header><div><small>${esc(t("panel.planner.tracking"))}</small><b>${esc(fit.best?.[0] ? title(fit.best[0].cluster) : t("panel.planner.coach"))}</b></div>
      ${button("minimize", t(state.minimized ? "panel.planner.expand" : "panel.planner.minimize"), `aria-expanded="${!state.minimized}" aria-controls="tracking-details"`)}</header>
      ${state.minimized ? "" : `<div id="tracking-details"><p class="progress-label">${esc(t("panel.planner.progress", { count, total: planned.size }))}</p>
        <progress value="${count}" max="${planned.size}"></progress><h3>${esc(t("panel.planner.next"))}</h3><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("") || `<li>${esc(t(state.game ? "panel.planner.wait" : "panel.planner.waitGame"))}</li>`}</ol>
        <div class="chips">${(fit.synergies ?? []).map((s) => `<span>${esc(name(s.syn, "synergy"))} <b>${Number(state.game?.synergies?.[s.syn] ?? 0)}/${Number(s.next ?? s.count)}</b></span>`).join("")}</div></div>`}</section>`
  }

  // Köprü koordinatları dışında oyunun DOM'una veya seçicilerine bağımlılık yoktur.
  function position(selector, r, extra = {}) {
    const el = surface.querySelector(selector)
    if (!el || !r || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) return
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, ...extra })
  }
  function render() {
    if (!state.ready) return
    if (state.settings.planner === false) {
      surface.innerHTML = ""
      try { if (host.matches(":popover-open")) host.hidePopover() } catch {}
      host.removeAttribute("popover")
      mountHost(false)
      return
    }
    const focus = root.activeElement
    const focusData = focus?.dataset ? { ...focus.dataset } : null
    const scrolls = [...surface.querySelectorAll(".comps,.recommendations,.coach,.chooser")].map((el) => [el.className, el.scrollTop])
    const plan = state.planner.board
    const fit = advice("planFit", { best: [], missing: [], synergies: [] }, plan)
    const rects = state.planner.rects
    const open = state.planner.open && rects
    if (!open) state.chooser = false
    // Üç kontrol tek araç çubuğunda: oyunun kendi düğmelerinin üstüne binmesinler diye başlık çubuğunda durur
    surface.innerHTML = `${open ? `<div class="toolbar"><div class="recommended-tab">${button("recommended", t("panel.planner.recommended"), `aria-expanded="${state.recommended}" aria-controls="recommendations"`)}</div>
      <div class="meta-action">${button("choose", t("panel.planner.start"), 'class="primary"')}</div><section class="coach card">${summary(plan, fit)}</section></div>
      ${state.recommended ? `<section id="recommendations" class="picker card"><header><h3>${esc(t("panel.planner.recommended"))}</h3>${button("recommended", t("panel.close"))}</header>${recommendations(plan)}</section>` : ""}
      ${state.chooser ? chooser(plan) : ""}` : ""}
      ${!state.planner.open && /^\/game(?:\/|$)/.test(location.pathname) && plan.length ? tracker(plan, fit) : ""}
      ${state.notice ? `<div class="notice card" role="status">${esc(state.notice)}</div>` : ""}`
    const inDialog = mountHost(Boolean(open))
    try {
      if (open && !inDialog) {
        // Yedek: dialog bulunamazsa en azından görünür kalsın
        host.setAttribute("popover", "manual")
        if (!host.matches(":popover-open")) host.showPopover()
      } else {
        if (host.matches(":popover-open")) host.hidePopover()
        host.removeAttribute("popover")
      }
    } catch {
      // Eski tarayıcılarda sabit konum ve z-index kullanılmaya devam edilir.
    }
    if (open) {
      position(".picker", rects.picker, { height: `${rects.picker.h}px` })
      // Başlık yoksa pencerenin üst kenarı; sağda oyunun kapatma düğmesine 64px yer bırak
      const bar = rects.header ?? { x: rects.modal.x, y: rects.modal.y, w: rects.modal.w, h: 52 }
      const toolbar = surface.querySelector(".toolbar")
      if (toolbar && [bar.x, bar.y, bar.w, bar.h].every(Number.isFinite)) Object.assign(toolbar.style, {
        top: `${Math.max(0, bar.y + Math.max(0, (bar.h - 44) / 2))}px`,
        right: `${Math.max(0, window.innerWidth - (bar.x + bar.w) + 64)}px`
      })
    }
    for (const [className, top] of scrolls) {
      const el = [...surface.querySelectorAll(".comps,.recommendations,.coach,.chooser")].find((el) => el.className === className)
      if (el) el.scrollTop = top
    }
    if (focusData) [...surface.querySelectorAll("button")].find((b) => Object.entries(focusData).every(([k, v]) => b.dataset[k] === v))?.focus({ preventScroll: true })
  }

  let noticeTimer, requestTimer, serial = 0, returnFocus
  function notice(key) {
    state.notice = t(key)
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { state.notice = ""; render() }, 6500)
    render()
  }
  function sendPlan(board) {
    if (state.pending || !Array.isArray(board) || !board.length) return
    const requestId = `pac-planner-${Date.now()}-${++serial}`
    state.pending = { requestId, board }
    window.postMessage({ type: "pac-yardimci:planner-set", board, requestId }, location.origin)
    requestTimer = setTimeout(() => { state.pending = null; notice("panel.planner.failed") }, 5000)
    render()
  }
  function add(pkm) {
    const plan = state.planner.board
    for (let y = 1; y <= 3; y++) for (let x = 0; x < 8; x++) {
      if (plan.some((p) => p.x === x && p.y === y)) continue
      return sendPlan([...plan, { name: pkm, x, y, items: [] }])
    }
    notice("panel.planner.full")
  }
  function closeChooser() {
    state.chooser = false
    render()
    ;(surface.querySelector('[data-action="choose"]') ?? returnFocus)?.focus()
  }
  root.addEventListener("click", (e) => {
    const el = e.target.closest("button")
    if (!el || el.disabled) return
    if (el.dataset.add) return add(el.dataset.add)
    if (el.dataset.cluster) { state.selected = el.dataset.cluster; render(); return }
    const action = el.dataset.action
    if (action === "recommended") state.recommended = !state.recommended
    if (action === "summary") state.summary = !state.summary
    if (action === "minimize") state.minimized = !state.minimized
    if (action === "filter") state.filter = el.dataset.filter
    if (action === "close") return closeChooser()
    if (action === "choose") { returnFocus = el; state.chooser = true }
    if (action === "replace" || action === "merge") {
      const cluster = state.meta?.clusters?.find((c) => c.id === state.selected)
      if (cluster) sendPlan(advice("compToPlan", [], cluster, { keepPlan: action === "merge" ? state.planner.board : null }))
      return
    }
    render()
    if (action === "choose") surface.querySelector('[data-action="close"]')?.focus()
  })
  // Oyunun modalı dialog'a gelen mousedown'ı "dışarı tıklandı" sanıp kapanmasın, oyunun tıklama işleyicileri tetiklenmesin
  for (const type of ["mousedown", "pointerdown", "mouseup", "pointerup"]) root.addEventListener(type, (e) => e.stopPropagation())
  for (const type of ["keydown", "keyup", "keypress"]) root.addEventListener(type, (e) => {
    e.stopPropagation()
    if (type !== "keydown" || !state.chooser) return
    if (e.key === "Escape") { e.preventDefault(); closeChooser() }
    if (e.key === "Tab") {
      const buttons = [...surface.querySelectorAll('.chooser button:not(:disabled)')]
      const first = buttons[0], last = buttons.at(-1)
      if (e.shiftKey && root.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && root.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  })
  window.addEventListener("message", (e) => {
    if (e.source !== window) return
    if (e.data?.type === "pac-yardimci:planner" && Array.isArray(e.data.planner?.board)) {
      state.planner = e.data.planner
    } else if (e.data?.type === "pac-yardimci:game") {
      state.game = e.data.snapshot
      if (state.planner.open) return
    } else if (e.data?.type === "pac-yardimci:planner-set-result" && state.pending?.requestId === e.data.requestId) {
      clearTimeout(requestTimer)
      if (e.data.ok) { state.planner.board = state.pending.board; state.chooser = false }
      state.pending = null
      notice(e.data.ok ? e.data.note === "reopen" ? "panel.planner.reopen" : "panel.planner.saved" : "panel.planner.failed")
      if (e.data.ok) surface.querySelector('[data-action="choose"]')?.focus()
    } else return
    render()
  })
  window.addEventListener("popstate", render)
  // SPA rota değişimleri yeni snapshot gelmese de takip kartını gizler/gösterir.
  let path = location.pathname
  const lifecycle = setInterval(() => {
    try { if (!chrome.runtime?.id) { clearInterval(lifecycle); host.remove(); return } } catch { clearInterval(lifecycle); host.remove(); return }
    if (path !== location.pathname) { path = location.pathname; render() }
  }, 1000)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    if (changes.settings) state.settings = { planner: true, tier: "LEVEL_BALL", minGames: 50, ...changes.settings.newValue }
    if (changes.meta) state.meta = changes.meta.newValue
    render()
  })
  I18n.onChange(async () => {
    try { state.text = await I18n.gameText() } catch { state.text = null }
    render()
  })
  async function init() {
    await I18n.ready
    const results = await Promise.allSettled([
      fetch(chrome.runtime.getURL("content/planner.css")).then((r) => r.text()),
      fetch(chrome.runtime.getURL("data/static.json")).then((r) => r.json()),
      chrome.storage.local.get(["settings", "meta"]), I18n.gameText()
    ])
    root.querySelector("style").textContent = results[0].status === "fulfilled" ? results[0].value : ""
    state.data = results[1].status === "fulfilled" ? results[1].value : null
    const stored = results[2].status === "fulfilled" ? results[2].value : {}
    state.settings = { ...state.settings, ...stored.settings }
    state.meta = stored.meta ?? null
    state.text = results[3].status === "fulfilled" ? results[3].value : null
    state.ready = true
    render()
    window.postMessage({ type: "pac-yardimci:hello" }, location.origin)
  }
  init().catch(() => host.remove())
})()
