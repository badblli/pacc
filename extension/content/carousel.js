// Seçim koçu yalnızca kendi gölge ağacına yazar; oyunda işlem yapmaz.
;(() => {
  if (document.getElementById("pac-carousel")) return
  const I18n = window.PacI18n
  const t = (key, vars) => I18n.t(key, vars)
  const esc = (s) => I18n.escapeHtml(s)
  const defaults = { overlay: true, tier: "LEVEL_BALL", minGames: 50 }
  const state = { settings: defaults, snap: null, plan: [], data: null, meta: null, text: null, minimized: false, ready: false }
  const host = document.createElement("div")
  host.id = "pac-carousel"
  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = '<style></style><div id="surface"></div>'
  document.documentElement.appendChild(host)
  const surface = root.getElementById("surface")
  const name = (key, kind = "pkm") => state.text?.[kind]?.[key] ?? I18n.humanize(key)
  const ctx = () => ({
    data: state.data, tierPokemons: state.meta?.pokemons?.[state.settings.tier] ?? {},
    tierItems: state.meta?.items?.[state.settings.tier] ?? {}, clusters: state.meta?.clusters ?? [],
    regionsMeta: state.meta?.regions, minGames: state.settings.minGames,
    thresholds: state.meta?.thresholds ?? null,
    names: { pkm: name, syn: (k) => name(k, "synergy"), item: (k) => name(k, "item") }, t
  })
  const reason = (r) => {
    if (!["craft", "component", "want", "comp"].includes(r?.kind)) return ""
    return t({ craft: "panel.carousel.reason.craft", component: "panel.carousel.reason.component", want: "panel.carousel.reason.want", comp: "panel.carousel.reason.comp" }[r.kind], { item: name(r.item, "item"), pkm: name(r.pkm) })
  }
  const portrait = ({ pkm }) => {
    const idx = state.data?.pkmIndex?.[pkm]
    return `<span class="portrait" title="${esc(name(pkm))}">${idx
      ? `<img src="/assets/portraits/${esc(String(idx).replace("-", "/"))}/Normal.png" alt="${esc(name(pkm))}">` : esc(name(pkm))}</span>`
  }
  function itemRow(row, i, max) {
    const score = Number.isFinite(row.score) ? row.score : 0
    const explanation = (row.reasons ?? []).map(reason).filter(Boolean).join(" · ")
    return `<li class="choice${row.taken ? " taken" : ""}"><span class="order">${i + 1}</span>
      <img class="item" src="/assets/item/${esc(row.item)}.png" alt="">
      <div class="body"><div class="line"><b class="name">${esc(name(row.item, "item"))}</b>${row.taken ? `<small>${esc(t("panel.carousel.taken"))}</small>` : ""}</div>
      <span class="reason" title="${esc(explanation)}">${esc(explanation)}</span>
      <meter min="0" max="${max}" value="${Math.max(0, score)}" aria-label="${esc(t("panel.carousel.score", { score }))}"></meter></div></li>`
  }
  function portalRow(row, i) {
    return `<li class="choice portal${row.taken ? " taken" : ""}"><span class="order">${i + 1}</span><div class="body">
      <div class="line"><b class="name">${esc(name(row.map, "map"))}</b><small>${esc(row.taken ? t("panel.carousel.taken")
        : Number.isFinite(row.meta?.rank) ? t("panel.carousel.meta", { rank: I18n.number(Number(row.meta.rank.toFixed(2))) }) : t("panel.carousel.noMeta"))}</small></div>
      <div class="portal-details"><div class="chips">${(row.synergies ?? []).map((syn) => `<span class="chip"><img src="/assets/types/${esc(syn)}.svg" alt="">${esc(name(syn, "synergy"))}</span>`).join("")}</div>
      <div class="portraits">${(row.regional ?? []).slice(0, 3).map(portrait).join("")}</div></div></div></li>`
  }
  function render() {
    if (!state.ready) return
    const kind = state.snap?.carousel?.kind
    let rows = []
    if (state.settings.overlay !== false && state.data && ["items", "portals"].includes(kind)) {
      try {
        const result = window.PacAdvisor?.[kind === "items" ? "rankCarousel" : "rankPortals"]?.(ctx(), state.snap, state.plan)
        if (Array.isArray(result)) rows = [...result].sort((a, b) => Number(Boolean(a.taken)) - Number(Boolean(b.taken)) || (b.score ?? 0) - (a.score ?? 0))
      } catch {
        // Paralel geliştirilen motor hazır değilse kart gizlenir.
      }
    }
    if (!rows.length) { surface.innerHTML = ""; return }
    if (kind === "items") rows = rows.slice(0, 5)
    const focused = root.activeElement?.dataset?.action === "toggle"
    const max = Math.max(1, ...rows.map((r) => Number.isFinite(r.score) ? r.score : 0))
    surface.innerHTML = `<section class="card" aria-label="${esc(t(kind === "items" ? "panel.carousel.items" : "panel.carousel.portals"))}">
      <button type="button" data-action="toggle" aria-expanded="${!state.minimized}" aria-controls="carousel-choices" title="${esc(t(state.minimized ? "panel.carousel.expand" : "panel.carousel.minimize"))}">
      <span><small>PACC</small><strong>${esc(t(kind === "items" ? "panel.carousel.items" : "panel.carousel.portals"))}</strong></span><span class="toggle" aria-hidden="true">${state.minimized ? "+" : "−"}</span></button>
      <ol id="carousel-choices" ${state.minimized ? "hidden" : ""}>${rows.map((r, i) => kind === "items" ? itemRow(r, i, max) : portalRow(r, i)).join("")}</ol></section>`
    if (focused) surface.querySelector("button")?.focus({ preventScroll: true })
  }
  root.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="toggle"]')) return
    state.minimized = !state.minimized
    render()
  })
  // Düğmenin klavye olayları oyunun kısayollarına ulaşmasın.
  for (const type of ["keydown", "keyup", "keypress"]) root.addEventListener(type, (e) => e.stopPropagation())
  window.addEventListener("message", (e) => {
    if (e.source !== window) return
    if (e.data?.type === "pac-yardimci:game") state.snap = e.data.snapshot
    else if (e.data?.type === "pac-yardimci:planner" && Array.isArray(e.data.planner?.board)) state.plan = e.data.planner.board
    else return
    render()
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    if (changes.settings) state.settings = { ...defaults, ...changes.settings.newValue }
    if (changes.meta) state.meta = changes.meta.newValue
    render()
  })
  I18n.onChange(async () => {
    const lang = I18n.lang
    const text = await I18n.gameText().catch(() => null)
    if (lang !== I18n.lang) return
    state.text = text
    render()
  })
  async function init() {
    await I18n.ready
    const [css, data, stored, text] = await Promise.all([
      fetch(chrome.runtime.getURL("content/carousel.css")).then((r) => { if (!r.ok) throw Error(); return r.text() }),
      fetch(chrome.runtime.getURL("data/static.json")).then((r) => { if (!r.ok) throw Error(); return r.json() }),
      chrome.storage.local.get(["settings", "meta"]), I18n.gameText().catch(() => null)
    ])
    root.querySelector("style").textContent = css
    Object.assign(state, { data, text, meta: stored.meta, settings: { ...defaults, ...stored.settings }, ready: true })
    render()
    window.postMessage({ type: "pac-yardimci:hello" }, location.origin)
  }
  init().catch(() => host.remove())
})()
