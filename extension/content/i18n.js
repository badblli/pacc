// Eklenti arayüzünün dil yardımcısı (İngilizce / Türkçe). Content script'lerde advisor/overlay/panel'den
// önce, popup'ta popup.js'ten önce yüklenir. Node testlerinde de çalışır (chrome yoksa kendi kendine yüklenmez;
// testler katalogları register() ile verir).
//
//   PacI18n.t("key", { name: "Pikachu", count: 2 })  → düz metin; {{var}} yerleştirme, key_one / key_other çoğul
//   PacI18n.html("key", { place: { html: "<b>3.1</b>" } })  → HTML'e güvenli metin (değişkenler kaçırılır, {html} hariç)
//   PacI18n.lang, PacI18n.setLang("tr"), PacI18n.onChange(fn), PacI18n.ready
//
// Dil ayarı: settings.uiLang = "auto" | "en" | "tr". "auto" tarayıcı dili "tr" ile başlıyorsa Türkçe, değilse İngilizce.
;(() => {
  const root = typeof window !== "undefined" ? window : globalThis
  if (root.PacI18n) return

  const LANGS = ["en", "tr"]
  const FALLBACK = "en"
  const catalogs = {}
  const listeners = new Set()
  const gameTexts = {}
  let lang = FALLBACK
  let strict = false

  // Eklenti yeniden yüklenince chrome.* çağrıları "Extension context invalidated" fırlatır.
  const extAlive = () => {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime?.id)
    } catch {
      return false
    }
  }
  const extUrl = (path) => {
    if (!extAlive()) throw new Error("extension context invalidated")
    return chrome.runtime.getURL(path)
  }
  const fetchJson = (path) => fetch(extUrl(path)).then((res) => {
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
    return res.json()
  })

  function browserLanguage() {
    try {
      const ui = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage?.()
      if (ui) return ui
    } catch {}
    try {
      return (typeof navigator !== "undefined" && navigator.language) || ""
    } catch {
      return ""
    }
  }

  function resolveLang(preference, browser = browserLanguage()) {
    if (LANGS.includes(preference)) return preference
    return String(browser ?? "").toLowerCase().startsWith("tr") ? "tr" : "en"
  }

  function pluralForm(count) {
    try {
      return new Intl.PluralRules(lang).select(count)
    } catch {
      return count === 1 ? "one" : "other"
    }
  }

  // Önce seçili dil, sonra İngilizce. Çoğulda key_<biçim>, yoksa key_other, yoksa key.
  function lookup(key, vars) {
    const count = typeof vars?.count === "number" ? vars.count : null
    for (const cat of [catalogs[lang], catalogs[FALLBACK]]) {
      if (!cat) continue
      if (count !== null) {
        const form = `${key}_${pluralForm(count)}`
        if (typeof cat[form] === "string") return cat[form]
        if (typeof cat[`${key}_other`] === "string") return cat[`${key}_other`]
      }
      if (typeof cat[key] === "string") return cat[key]
    }
    if (strict) throw new Error(`[i18n] missing key "${key}" (${lang})`)
    return key
  }

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

  function format(template, vars, escape) {
    const e = escape ?? ((s) => s)
    return String(template)
      .split(/(\{\{\s*\w+\s*\}\})/)
      .map((part, i) => {
        if (i % 2 === 0) return e(part)
        const name = part.slice(2, -2).trim()
        const value = vars?.[name]
        if (value === undefined || value === null) {
          if (strict) throw new Error(`[i18n] missing variable "${name}" in "${template}"`)
          return ""
        }
        // { html } değerleri önceden kaçırılmış/güvenli HTML'dir (ör. <b>3.1</b>)
        if (typeof value === "object" && typeof value.html === "string") return value.html
        return e(String(value))
      })
      .join("")
  }

  const t = (key, vars) => format(lookup(key, vars), vars)
  const html = (key, vars) => format(lookup(key, vars), vars, escapeHtml)

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn(lang)
      } catch (err) {
        console.warn("[i18n] listener failed", err)
      }
    }
  }

  function apply(next) {
    if (next === lang) return
    lang = next
    emit()
  }

  async function loadCatalog(l) {
    if (!catalogs[l]) catalogs[l] = await fetchJson(`i18n/${l}.json`)
    return catalogs[l]
  }

  // Katalog zaten yüklüyse (ya da register edildiyse) dil hemen değişir; değilse önce yüklenir.
  function setLang(l) {
    const next = LANGS.includes(l) ? l : FALLBACK
    if (catalogs[next] && catalogs[FALLBACK]) {
      apply(next)
      return Promise.resolve(next)
    }
    return Promise.all([loadCatalog(FALLBACK), loadCatalog(next)]).then(() => {
      apply(next)
      return next
    })
  }

  // Pokémon / item / sinerji adları ve item açıklamaları: Türkçede oyunun TR çeviri dosyası,
  // İngilizcede oyunun İngilizce metinlerinden üretilmiş küçük dosya (scripts/build-i18n-game-en.mjs).
  const GAME_TEXT = { tr: "locales/tr/translation.json", en: "i18n/game.en.json" }
  function gameText(l = lang) {
    const key = GAME_TEXT[l] ? l : FALLBACK
    gameTexts[key] ??= fetchJson(GAME_TEXT[key]).catch((err) => {
      delete gameTexts[key]
      throw err
    })
    return gameTexts[key]
  }

  // Oyun metninde adı olmayan (yeni eklenmiş) anahtar için okunur ad: "SANDY_SHOCKS" → "Sandy Shocks"
  const humanize = (key) =>
    String(key ?? "")
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")

  async function init() {
    if (!extAlive()) return lang
    let preference = "auto"
    try {
      const { settings } = await chrome.storage.local.get("settings")
      preference = settings?.uiLang ?? "auto"
    } catch {}
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.settings) return
        const next = resolveLang(changes.settings.newValue?.uiLang ?? "auto")
        if (next !== lang) setLang(next).catch(() => {})
      })
    } catch {}
    try {
      await setLang(resolveLang(preference))
    } catch {
      // Katalog okunamazsa metinler anahtar olarak görünür; panel yine de çalışır.
    }
    return lang
  }

  root.PacI18n = {
    LANGS,
    t,
    html,
    format,
    escapeHtml,
    resolveLang,
    browserLanguage,
    setLang,
    gameText,
    humanize,
    get lang() {
      return lang
    },
    // Sayı / tarih biçimi için yerel ayar
    locale: () => (lang === "tr" ? "tr-TR" : "en-US"),
    number: (n) => Number(n).toLocaleString(lang === "tr" ? "tr-TR" : "en-US"),
    register(l, catalog) {
      catalogs[l] = catalog
    },
    has: (key) => typeof catalogs[lang]?.[key] === "string" || typeof catalogs[FALLBACK]?.[key] === "string",
    // Testler için: eksik anahtar / değişken hata fırlatır
    get strict() {
      return strict
    },
    set strict(value) {
      strict = Boolean(value)
    },
    onChange(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    ready: null
  }
  root.PacI18n.ready = init()
})()
