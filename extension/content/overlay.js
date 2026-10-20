// Kartlara dokunmadan, ayrı bir shadow DOM katmanında önerileri gösterir.
// Eklenti hiçbir şeye tıklamaz/sürüklemez: item birleştirme ipuçları da sadece görsel işarettir.
;(() => {
  if (window.__pacOverlay) return
  window.__pacOverlay = true

  // Eklenti yeniden yüklenince eski content script sayfada kalır; chrome.* çağrıları
  // "Extension context invalidated" fırlatır. Her çağrıyı bu kontrolle sarıyoruz.
  const extAlive = () => {
    try {
      return Boolean(chrome.runtime?.id)
    } catch {
      return false
    }
  }

  const defaults = { overlay: true, tier: "LEVEL_BALL", minGames: 50 }
  // text: seçili dildeki oyun metinleri (Pokémon / item / sinerji adları)
  const state = { settings: defaults, meta: null, text: null, data: null, snap: null, screen: null, screenAt: -Infinity }
  const I18n = window.PacI18n
  const t = (key, vars) => I18n.t(key, vars)
  const host = document.createElement("div")
  host.id = "pac-board-overlay"
  host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000"
  const root = host.attachShadow({ mode: "open" })
  // <link> yerine <style>: sayfanın CSP kuralı eklenti URL'sinden stil yüklemeyi engelleyebilir (panel.js de böyle yapıyor)
  const sheet = document.createElement("style")
  const layer = document.createElement("div")
  layer.className = "surface"
  const tooltip = document.createElement("div")
  tooltip.className = "tooltip"
  tooltip.hidden = true
  tooltip.setAttribute("role", "tooltip")
  const toast = document.createElement("div")
  toast.className = "toast"
  toast.hidden = true
  toast.setAttribute("role", "status")
  root.append(sheet, layer, tooltip, toast)
  document.documentElement.append(host)

  // Rozet metinleri: overlay.best / overlay.good / overlay.avoid (neutral rozet almaz)
  const VERDICTS = new Set(["best", "good", "avoid"])
  const verdictText = (verdict) => t(`overlay.${verdict}`)
  // Birden çok tarif: her tarifin kendi rengi ve numara çifti (①②, ③④, ...)
  const craftColors = ["#ffd166", "#7cc8ff", "#ff9ff3", "#b9ff8a"]
  const circled = (n) => (n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : `(${n})`)
  const PHASE_PICK = 0
  const SCREEN_TTL = 1500
  const nodes = new Map()
  let targets = []
  let advice = null
  let dirty = true
  let ready = false
  let pointer = null
  let timer = null
  let frame = null
  let toastTimer = null
  let lastMeasure = -Infinity
  let craftOn = true
  let hiddenAll = false
  let dead = false

  const names = {
    pkm: (key) => state.text?.pkm?.[key] ?? I18n.humanize(key),
    item: (key) => state.text?.item?.[key] ?? I18n.humanize(key),
    syn: (key) => state.text?.synergy?.[key] ?? I18n.humanize(key)
  }

  const pctOf = (option) => {
    const n = Number(option?.pct)
    return option?.pct != null && Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : null
  }
  const pctText = (option) => {
    const p = pctOf(option)
    return p === null ? "" : ` · ${t("num.pct", { n: p })}`
  }

  function visibleRect(element) {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    if (style.visibility !== "visible" || style.display === "none" ||
        (element.checkVisibility && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) ||
        rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 ||
        rect.top >= innerHeight || rect.left >= innerWidth) return null
    return rect
  }

  // game-hook'tan gelen düz {left, top, width, height} nesnesini doğrula
  function plainRect(r) {
    if (!r || ![r.left, r.top, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) return null
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height }
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return null
    return rect
  }

  // Evrim zinciri satırı: "Charmander → **Charmeleon** → Charizard" (fonksiyon yoksa sessizce atla)
  function chainLine(key) {
    if (!key || typeof window.PacAdvisor?.familyChain !== "function") return null
    try {
      const chain = window.PacAdvisor.familyChain(state.data, key)
      if (!Array.isArray(chain) || chain.length < 2) return null
      return chain.flatMap((pkm, i) => [
        ...(i ? [{ text: " → " }] : []),
        { text: names.pkm(pkm), bold: pkm === key }
      ])
    } catch {
      return null
    }
  }

  function collect() {
    const found = []
    const add = (elements, options, shop, expectedCount = options.length) => {
      // Sıra eşleştirmesi ancak bütün seçenekler DOM'daysa güvenlidir.
      if (elements.length !== expectedCount) return
      const indices = new Set(options.map((option) => option.index))
      if (indices.size !== options.length || options.some((option) =>
        !Number.isInteger(option.index) || option.index < 0 || option.index >= elements.length)) return
      for (const option of options) {
        if (!VERDICTS.has(option.verdict)) continue
        const element = elements[option.index]
        if (element.classList.contains("empty")) continue
        const rect = visibleRect(element)
        if (!rect) continue
        const key = shop ? state.snap.shop[option.index] : currentChoiceOption(option.index)
        const isItem = !shop && choice?.kind === "item"
        const name = isItem ? names.item(key) : names.pkm(key)
        const tag = typeof option.tag === "string" && option.tag ? ` · ${option.tag}` : ""
        const chain = isItem ? null : chainLine(key)
        // Dar kartta (küçük pencere) uzun rozet kesiliyor: dükkan gibi kısa biçim kullan
        const compact = shop || rect.width < 150
        const symbol = option.verdict === "best" ? "★" : option.verdict === "avoid" ? "✗" : "✓"
        found.push({
          key: element,
          rect,
          className: `mark ${option.verdict}${shop ? " shop" : ""}`,
          // Dükkan rozeti dar: "★ %82"; seçim kartı: "✓ Önerilen · %82"
          badge: compact
            ? symbol + (pctOf(option) === null ? "" : ` ${t("num.pct", { n: pctOf(option) })}`)
            : verdictText(option.verdict) + pctText(option),
          reason: shop ? "" : (option.reasons?.[0] ?? ""),
          title: `${name ?? ""} · ${verdictText(option.verdict)}${pctText(option)}${tag}`,
          lines: [...(chain ? [chain] : []), ...(option.reasons ?? [])]
        })
      }
    }
    const choice = advice?.choice
    const current = state.snap?.choices?.[0]
    const currentChoiceOption = (index) => choice?.kind === "item" ? current?.items?.[index] : current?.pokemons?.[index]
    if (choice && current && choice.id === current.id && choice.type === current.type) {
      const kind = choice.kind === "item" ? "items" : choice.kind === "pokemon" ? "pokemons" : null
      if (kind && current[kind]?.length === choice.options?.length) {
        for (const container of document.querySelectorAll("div.game-choice > div.my-container")) {
          if (!visibleRect(container)) continue
          add([...container.querySelectorAll(`div.game-choice-${kind}-list > div.my-box`)], choice.options, false)
          break
        }
      }
    }
    if (Array.isArray(advice?.shop) && Array.isArray(state.snap?.shop)) {
      const filled = state.snap.shop.flatMap((pkm, index) => pkm && pkm !== "DEFAULT" ? [index] : [])
      if (advice.shop.length === filled.length && advice.shop.every((option) => filled.includes(option.index))) {
        add([...document.querySelectorAll("ul.game-pokemons-store > div.game-pokemon-portrait")],
          advice.shop, true, state.snap.shop.length)
      }
    }
    return found
  }

  // Tahtadaki (canvas) item birleştirme işaretleri: parça ikonlarına ①②, hedef Pokémona halka + "→ Item"
  function collectCraft() {
    const recipes = advice?.craft
    const screen = state.screen
    if (!craftOn || !Array.isArray(recipes) || !recipes.length) return []
    if (!screen || performance.now() - state.screenAt > SCREEN_TTL) return []
    // Savaş / kasaba fazında gizle
    if (screen.mode && screen.mode !== "pick") return []
    if (typeof state.snap?.phase === "number" && state.snap.phase !== PHASE_PICK) return []
    const items = Array.isArray(screen.items) ? screen.items : []
    const units = Array.isArray(screen.units) ? screen.units : []
    const used = new Set()
    const take = (item) => {
      const i = items.findIndex((it, i) => !used.has(i) && it?.item === item && plainRect(it.rect))
      if (i < 0) return null
      used.add(i)
      return plainRect(items[i].rect)
    }
    const findUnit = (recipe) => {
      const ti = Number.isInteger(recipe.targetIndex) ? recipe.targetIndex : null
      const ref = ti !== null ? state.snap?.board?.[ti] : null
      let unit = ti !== null ? units.find((u) => u?.index === ti && (!ref || u.name === ref.name)) : null
      if (!unit && ref) unit = units.find((u) => u?.name === ref.name && u.x === ref.x && u.y === ref.y)
      if (!unit && typeof recipe.target === "string") {
        const same = units.filter((u) => u?.name === recipe.target)
        if (same.length === 1) unit = same[0]
      }
      return unit ?? null
    }
    const found = []
    const stack = new Map()
    recipes.slice(0, craftColors.length).forEach((recipe, k) => {
      if (!recipe || typeof recipe.item !== "string" || !Array.isArray(recipe.components) || recipe.components.length < 2) return
      const [a, b] = recipe.components
      const color = craftColors[k]
      const nums = [circled(2 * k + 1), circled(2 * k + 2)]
      const itemName = names.item(recipe.item)
      const unit = findUnit(recipe)
      const targetName = unit ? names.pkm(unit.name) : (typeof recipe.target === "string" ? names.pkm(recipe.target) : null)
      const title = `${names.item(a)} + ${names.item(b)} → ${itemName}${pctText(recipe)}`
      const lines = [
        targetName ? t("overlay.dragOnto", { name: targetName }) : t("overlay.combine"),
        ...(typeof recipe.reason === "string" && recipe.reason ? [recipe.reason] : [])
      ]
      ;[a, b].forEach((component, j) => {
        const rect = take(component)
        if (!rect) return
        found.push({
          key: `craft:${k}:${j}`, rect, color, title, lines,
          className: "craft part", badge: nums[j], reason: ""
        })
      })
      const unitRect = unit && plainRect(unit.rect)
      if (unitRect) {
        // Komşu Pokémonların rozetleri çakışmasın: tek tarifler üstte, çiftler altta;
        // aynı Pokémona aynı tarafta birden çok tarif düşerse rozetleri üst üste diz
        const below = k % 2 === 1
        const side = `${unit.index}:${below}`
        const level = stack.get(side) ?? 0
        stack.set(side, level + 1)
        found.push({
          key: `craft:${k}:t`, rect: unitRect, color, title, lines, level,
          className: `craft ring${below ? " below" : ""}`, badge: `${nums[0]}+${nums[1]} → ${itemName}`, reason: ""
        })
      }
    })
    return found
  }

  function showTooltip() {
    const target = !hiddenAll && pointer && targets.find(({ rect }) => pointer.x >= rect.left && pointer.x <= rect.right &&
      pointer.y >= rect.top && pointer.y <= rect.bottom)
    tooltip.hidden = !target
    if (!target) return
    const { rect } = target
    const title = document.createElement("strong")
    title.textContent = target.title ?? ""
    const lines = (target.lines ?? []).map((content) => {
      const line = document.createElement("div")
      if (Array.isArray(content)) {
        line.className = "chain"
        for (const part of content) {
          const span = document.createElement(part.bold ? "b" : "span")
          span.textContent = part.text
          line.append(span)
        }
      } else {
        line.textContent = content
      }
      return line
    })
    tooltip.style.setProperty("--accent", target.color ?? "var(--green)")
    tooltip.replaceChildren(title, ...lines)
    tooltip.style.width = `${Math.min(280, Math.max(0, innerWidth - 16))}px`
    const height = tooltip.getBoundingClientRect().height
    const width = tooltip.getBoundingClientRect().width
    let left = rect.left
    let top = rect.bottom + 8
    if (top + height > innerHeight - 8) {
      left = rect.right + 8 + width <= innerWidth ? rect.right + 8 : rect.left - width - 8
      top = rect.top
    }
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, left))}px`
    tooltip.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, top))}px`
  }

  function measure(now) {
    const started = performance.now()
    try { measureInner(now) } finally {
      const ms = performance.now() - started
      if (ms > 40) console.warn(`[PACC perf] tahta önerileri: ${ms.toFixed(0)} ms`)
    }
  }
  function measureInner(now) {
    lastMeasure = now
    if (!extAlive()) return teardown()
    if (ready && !hiddenAll && state.settings.overlay !== false && state.snap && typeof window.PacAdvisor?.boardAdvice === "function") {
      if (dirty) {
        try {
          const tier = state.settings.tier
          advice = window.PacAdvisor.boardAdvice({
            data: state.data,
            tierPokemons: state.meta?.pokemons?.[tier] ?? {},
            tierItems: state.meta?.items?.[tier] ?? {},
            clusters: state.meta?.clusters ?? [],
            minGames: state.settings.minGames,
            thresholds: state.meta?.thresholds,
            names,
            t
          }, state.snap)
          dirty = false
        } catch {
          advice = null
        }
      }
      targets = collect()
      try {
        targets.push(...collectCraft())
      } catch {
        // Konum verisi bozuksa sadece craft işaretlerini atla
      }
    } else {
      advice = null
      dirty = true
      targets = []
    }
    const live = new Set()
    for (const target of targets) {
      const { key, rect } = target
      live.add(key)
      let node = nodes.get(key)
      if (!node) {
        node = document.createElement("div")
        node.append(document.createElement("span"), document.createElement("span"))
        node.firstChild.className = "badge"
        node.lastChild.className = "reason"
        layer.append(node)
        nodes.set(key, node)
      }
      node.className = target.className
      node.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px` +
        (target.color ? `;--c:${target.color}` : "") + (target.level ? `;--level:${target.level}` : "")
      node.firstChild.textContent = target.badge ?? ""
      node.lastChild.textContent = target.reason ?? ""
    }
    for (const [key, node] of nodes) {
      if (!live.has(key)) {
        node.remove()
        nodes.delete(key)
      }
    }
    showTooltip()
  }

  // Boştayken 250 ms, hedef varken en fazla 10 Hz. Olaylar aynı ölçümde birleşir.
  function schedule() {
    if (frame !== null || dead) return
    clearTimeout(timer)
    const delay = Math.max(0, 100 - (performance.now() - lastMeasure))
    timer = setTimeout(() => {
      frame = requestAnimationFrame((now) => {
        frame = null
        measure(now)
        if (!dead) timer = setTimeout(schedule, targets.length ? 100 : 250)
      })
    }, delay)
  }

  function flash(text) {
    toast.textContent = text
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.hidden = true }, 1600)
  }

  // ---- olay dinleyicileri (teardown'da hepsi sökülür) ----
  const onMessage = (event) => {
    if (event.source !== window) return
    if (event.data?.type === "pac-yardimci:game") {
      state.snap = event.data.snapshot
      dirty = true
      schedule()
    } else if (event.data?.type === "pac-yardimci:screen") {
      // Konum değişimi öneriyi yeniden hesaplatmaz, sadece yeniden çizer
      const screen = event.data.screen
      state.screen = screen && typeof screen === "object" ? screen : null
      state.screenAt = performance.now()
      schedule()
    }
  }
  const onPointerMove = (event) => {
    pointer = { x: event.clientX, y: event.clientY }
    showTooltip()
  }
  const hideTip = () => {
    pointer = null
    tooltip.hidden = true
  }
  // Kısayollar: Alt+I item birleştirme işaretleri, Alt+O tüm katman. Sadece bu ikisinde preventDefault;
  // diğer tuşlara hiç dokunmuyoruz, olay oyuna normal akar.
  const onKey = (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.code !== "KeyI" && event.code !== "KeyO") return
    const el = event.target
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ""))) return
    event.preventDefault()
    if (event.repeat) return
    if (event.code === "KeyI") {
      craftOn = !craftOn
      flash(t("overlay.toast.craft", { state: t(craftOn ? "overlay.state.on" : "overlay.state.off") }))
    } else {
      hiddenAll = !hiddenAll
      layer.hidden = hiddenAll
      if (hiddenAll) tooltip.hidden = true
      flash(t("overlay.toast.layer", { name: t("app.name"), state: t(hiddenAll ? "overlay.state.hidden" : "overlay.state.visible") }))
    }
    schedule()
  }
  const onStorage = (changes, area) => {
    if (area !== "local") return
    if (changes.settings) state.settings = { ...defaults, ...changes.settings.newValue }
    if (changes.meta) state.meta = changes.meta.newValue ?? null
    dirty = true
    schedule()
  }

  window.addEventListener("message", onMessage)
  window.addEventListener("resize", schedule, { passive: true })
  document.addEventListener("scroll", schedule, { passive: true, capture: true })
  document.addEventListener("pointermove", onPointerMove, { passive: true })
  document.addEventListener("pointerleave", hideTip, { passive: true })
  window.addEventListener("blur", hideTip)
  window.addEventListener("keydown", onKey, true)
  try {
    if (extAlive()) chrome.storage.onChanged.addListener(onStorage)
  } catch {}
  // Dil değişince adları yeni dilde yükle; gerekçeler bir sonraki ölçümde yeniden hesaplanır.
  const offLang = I18n.onChange(async (lang) => {
    if (dead) return
    try {
      if (!extAlive()) return teardown()
      const text = await I18n.gameText(lang)
      if (!dead && lang === I18n.lang) state.text = text
    } catch {
      if (!extAlive()) return teardown()
    }
    dirty = true
    schedule()
  })

  // Eklenti bağlamı geçersizse: katmanı kaldır, zamanlayıcıları ve dinleyicileri durdur
  function teardown() {
    if (dead) return
    dead = true
    clearTimeout(timer)
    clearTimeout(toastTimer)
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    window.removeEventListener("message", onMessage)
    window.removeEventListener("resize", schedule)
    document.removeEventListener("scroll", schedule, { capture: true })
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerleave", hideTip)
    window.removeEventListener("blur", hideTip)
    window.removeEventListener("keydown", onKey, true)
    offLang()
    try {
      chrome.storage?.onChanged?.removeListener(onStorage)
    } catch {}
    nodes.clear()
    host.remove()
    window.__pacOverlay = false
    console.info("[PACC] Eklenti yeniden yüklendi; eski tahta katmanı kapatıldı. Sayfayı yenileyin.")
  }

  async function init() {
    try {
      if (!extAlive()) return teardown()
      const url = (path) => chrome.runtime.getURL(path)
      const json = (path) => fetch(url(path)).then((res) => res.json())
      await I18n.ready
      if (!extAlive()) return teardown()
      const [css, text, data, stored] = await Promise.all([
        fetch(url("content/overlay.css")).then((res) => res.text()),
        I18n.gameText(I18n.lang), json("data/static.json"),
        chrome.storage.local.get(["settings", "meta"])
      ])
      if (!extAlive()) return teardown()
      sheet.textContent = css
      state.text = text
      state.data = data
      state.settings = { ...defaults, ...stored.settings }
      state.meta = stored.meta ?? null
      ready = true
      schedule()
      if (!state.meta && extAlive()) {
        const response = await chrome.runtime.sendMessage({ type: "get-meta" })
        if (response?.meta) state.meta = response.meta
        dirty = true
        schedule()
      }
    } catch {
      // Dosyalar yüklenemezse (ya da bağlam koptuysa) oyuna hata veya eksik öneri taşımayız.
      if (!extAlive()) teardown()
    }
  }

  window.postMessage({ type: "pac-yardimci:hello" }, location.origin)
  init()
})()
