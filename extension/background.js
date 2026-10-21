// Oyunun herkese açık meta API'sinden veriyi çeker, küçültür ve önbelleğe alır.
// Sunucu raporu günde bir yeniler; biz 6 saatte bir sadece /meta/metadata'yı
// kontrol edip rapor değiştiyse büyük dosyaları indiriyoruz.

const API = "https://pokemon-auto-chess.com"
const CHECK_MINUTES = 6 * 60
// Elle yenilemede küçük kontrol isteğini bile en fazla dakikada bir at
const MANUAL_MIN_INTERVAL_MS = 60 * 1000
// compact* fonksiyonlarının çıktısı değişince artır: eski biçimde kayıtlı veri bir kez yeniden indirilir
const META_FORMAT = 3
const DEFAULT_SETTINGS = { uiLang: "auto", panel: true, alert: true, updateCheck: true, overlay: true, poolTracking: false, tier: "auto", minGames: 50 }

// content/i18n.js'teki resolveLang ile aynı kural (service worker o dosyayı yüklemiyor):
// "auto" → tarayıcı dili "tr" ile başlıyorsa Türkçe, değilse İngilizce.
function resolveLang(preference) {
  if (preference === "en" || preference === "tr") return preference
  let ui = ""
  try {
    ui = chrome.i18n.getUILanguage() || ""
  } catch {}
  return ui.toLowerCase().startsWith("tr") ? "tr" : "en"
}

// Oyunun Türkçe çevirisi (tr_redirect) varsayılan olarak yalnız Türkçe arayüzde açık.
function withDefaults(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  if (typeof s.translation !== "boolean") s.translation = resolveLang(s.uiLang) === "tr"
  return s
}

async function getJson(path) {
  const res = await fetch(API + path)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json()
}

// /meta/pokemons ~30 MB, çoğu geçmiş verisi. Sadece ihtiyacımız olanı tutuyoruz:
// tier -> pokemon -> [ortalama sıra, oyun sayısı, ortalama item sayısı, en çok kullanılan itemler]
function compactPokemons(raw) {
  const out = {}
  for (const { tier, pokemons } of raw) {
    out[tier] = {}
    for (const [name, p] of Object.entries(pokemons)) {
      if (p.count > 0) out[tier][name] = [p.rank, p.count, p.item_count, p.items]
    }
  }
  return out
}

// tier -> item -> [ortalama sıra, kullanım sayısı, en çok taşıyan Pokémonlar]
function compactItems(raw) {
  const out = {}
  for (const { tier, items } of raw) {
    out[tier] = {}
    for (const [name, it] of Object.entries(items)) {
      if (it.count > 0) out[tier][name] = [it.rank, it.count, it.pokemons]
    }
  }
  return out
}

function compactClusters(raw) {
  return raw.map((c) => ({
    id: c.cluster_id,
    count: c.count,
    winrate: c.winrate,
    rank: c.mean_rank,
    // meta-v2 sinerjileri küçük harfle geliyor ("water"), oyunun geri kalanı büyük harf kullanıyor
    synergies: Object.fromEntries(Object.entries(c.synergies ?? {}).map(([s, n]) => [s.toUpperCase(), n])),
    pokemons: Object.entries(c.mean_team?.pokemons ?? {})
      .map(([name, p]) => ({ name, frequency: p.frequency, items: p.items }))
      .sort((a, b) => b.frequency - a.frequency),
    items: c.mean_items ?? [],
    topTeams: (c.top_teams ?? []).slice(0, 3)
  }))
}

// bölge -> [ortalama sıra, oyun sayısı, öne çıkan Pokémonlar]
function compactRegions(raw) {
  const out = {}
  for (const { name, rank, count, pokemons } of raw) {
    if (count > 0) out[name] = [rank, count, pokemons]
  }
  return out
}

let refreshing = null

// Büyük dosyaları (~38 MB) sadece sunucudaki rapor değiştiyse ya da kayıtlı veri eski
// biçimdeyse indirir; elle yenileme de bu kurala uyar (oyunun sunucusunu yormamak için).
// Dönüş: büyük dosyalar indirildiyse true, veri zaten güncelse false.
async function refresh({ manual = false } = {}) {
  if (refreshing) return refreshing
  refreshing = (async () => {
    if (manual) {
      const { meta } = await chrome.storage.local.get("meta")
      if (meta?.format === META_FORMAT && Date.now() - (meta.checkedAt ?? 0) < MANUAL_MIN_INTERVAL_MS) return false
    }
    const [metadata] = await getJson("/meta/metadata")
    // Sinerji eşikleri (ör. WATER: [3, 6, 9]) — küçük, her kontrolde güncelliyoruz
    const thresholds = await getJson("/types-trigger").catch(() => null)
    const { meta } = await chrome.storage.local.get("meta")
    if (meta && meta.format === META_FORMAT && meta.createdAt === metadata.created_at) {
      await chrome.storage.local.set({ meta: { ...meta, thresholds: thresholds ?? meta.thresholds, checkedAt: Date.now() } })
      return false
    }
    const [clusters, pokemons, items, regions] = await Promise.all([
      getJson("/meta-v2"),
      getJson("/meta/pokemons"),
      getJson("/meta/items"),
      getJson("/meta/regions")
    ])
    await chrome.storage.local.set({
      meta: {
        format: META_FORMAT,
        createdAt: metadata.created_at,
        timeLimit: metadata.time_limit,
        games: metadata.count,
        checkedAt: Date.now(),
        thresholds,
        clusters: compactClusters(clusters),
        pokemons: compactPokemons(pokemons),
        items: compactItems(items),
        regions: compactRegions(regions)
      },
      metaError: null
    })
    return true
  })()
    .catch(async (err) => {
      console.warn("[PACC] meta verisi alınamadı", err)
      await chrome.storage.local.set({ metaError: String(err.message ?? err) })
      throw err
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function applySettings() {
  const { settings } = await chrome.storage.local.get("settings")
  const s = withDefaults(settings)
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    s.translation ? { enableRulesetIds: ["tr_redirect"] } : { disableRulesetIds: ["tr_redirect"] }
  )
}

// Yeni sürüm denetimi: GitHub'dan kurulan eklenti kendiliğinden güncellenmez.
// En çok 12 saatte bir herkese açık "son sürüm" bilgisini okur (kullanıcı verisi gönderilmez);
// daha yeni sürüm varsa simgeye rozet koyar, popup indirme bağlantısını gösterir. Ayardan kapatılabilir.
const RELEASES_URL = "https://api.github.com/repos/badblli/pacc/releases/latest"
const RELEASE_PAGE = "https://github.com/badblli/pacc/releases/"
const UPDATE_MS = 12 * 60 * 60 * 1000

function isNewer(version, current) {
  const a = String(version).split(".").map(Number), b = String(current).split(".").map(Number)
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  return false
}

async function showUpdateBadge(update, settings) {
  const has = Boolean(update) && withDefaults(settings).updateCheck !== false && isNewer(update.version, chrome.runtime.getManifest().version)
  // Rozet metni _locales'tan (tarayıcı dili): "NEW" / "YENİ"
  await chrome.action.setBadgeText({ text: has ? (chrome.i18n.getMessage("badgeNew") || "NEW") : "" })
  if (has) await chrome.action.setBadgeBackgroundColor({ color: "#ffc107" })
  return has
}

async function checkUpdate({ force = false } = {}) {
  const { settings, update } = await chrome.storage.local.get(["settings", "update"])
  if (withDefaults(settings).updateCheck === false) return showUpdateBadge(null, settings)
  if (!force && update?.checkedAt && Date.now() - update.checkedAt < UPDATE_MS) return showUpdateBadge(update, settings)
  const res = await fetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const release = await res.json()
  const version = String(release?.tag_name ?? "").replace(/^v/, "")
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid release tag")
  // Bağlantı yalnız kendi depomuzun sürüm sayfası olabilir
  const url = typeof release.html_url === "string" && release.html_url.startsWith(RELEASE_PAGE) ? release.html_url : RELEASE_PAGE + "latest"
  const next = { version, url, checkedAt: Date.now() }
  await chrome.storage.local.set({ update: next })
  return showUpdateBadge(next, settings)
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings")
  await chrome.storage.local.set({ settings: withDefaults(settings) })
  await applySettings()
  chrome.alarms.create("meta-check", { periodInMinutes: CHECK_MINUTES })
  refresh().catch(() => {})
  checkUpdate({ force: true }).catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  applySettings()
  refresh().catch(() => {})
  checkUpdate().catch(() => {})
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "meta-check") {
    refresh().catch(() => {})
    checkUpdate().catch(() => {})
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) {
    applySettings()
    // Dil ya da denetim ayarı değişince rozet güncellensin
    chrome.storage.local.get("update").then(({ update }) => showUpdateBadge(update, changes.settings.newValue)).catch(() => {})
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "check-update") {
    checkUpdate().then((has) => sendResponse({ has })).catch(() => sendResponse({ has: false }))
    return true
  }
  if (msg?.type === "get-meta") {
    ;(async () => {
      let { meta } = await chrome.storage.local.get("meta")
      if (!meta) {
        try {
          await refresh()
          ;({ meta } = await chrome.storage.local.get("meta"))
        } catch (err) {
          sendResponse({ error: String(err.message ?? err) })
          return
        }
      }
      sendResponse({ meta })
    })()
    return true
  }
  if (msg?.type === "refresh-meta") {
    refresh({ manual: true })
      .then((updated) => sendResponse({ ok: true, updated }))
      .catch((err) => sendResponse({ error: String(err.message ?? err) }))
    return true
  }
})
