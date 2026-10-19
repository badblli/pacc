// Oyunun herkese açık meta API'sinden veriyi çeker, küçültür ve önbelleğe alır.
// Sunucu raporu günde bir yeniler; biz 6 saatte bir sadece /meta/metadata'yı
// kontrol edip rapor değiştiyse büyük dosyaları indiriyoruz.

const API = "https://pokemon-auto-chess.com"
const CHECK_MINUTES = 6 * 60
const DEFAULT_SETTINGS = { translation: true, panel: true, overlay: true, poolTracking: false, tier: "LEVEL_BALL", minGames: 50 }

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

let refreshing = null

async function refresh(force = false) {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const [metadata] = await getJson("/meta/metadata")
    // Sinerji eşikleri (ör. WATER: [3, 6, 9]) — küçük, her kontrolde güncelliyoruz
    const thresholds = await getJson("/types-trigger").catch(() => null)
    const { meta } = await chrome.storage.local.get("meta")
    if (!force && meta && meta.createdAt === metadata.created_at) {
      await chrome.storage.local.set({ meta: { ...meta, thresholds: thresholds ?? meta.thresholds, checkedAt: Date.now() } })
      return
    }
    const [clusters, pokemons, items] = await Promise.all([
      getJson("/meta-v2"),
      getJson("/meta/pokemons"),
      getJson("/meta/items")
    ])
    await chrome.storage.local.set({
      meta: {
        createdAt: metadata.created_at,
        timeLimit: metadata.time_limit,
        games: metadata.count,
        checkedAt: Date.now(),
        thresholds,
        clusters: compactClusters(clusters),
        pokemons: compactPokemons(pokemons),
        items: compactItems(items)
      },
      metaError: null
    })
  })()
    .catch(async (err) => {
      console.warn("[PAC Koç] meta verisi alınamadı", err)
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
  const s = { ...DEFAULT_SETTINGS, ...settings }
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    s.translation ? { enableRulesetIds: ["tr_redirect"] } : { disableRulesetIds: ["tr_redirect"] }
  )
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings")
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings } })
  await applySettings()
  chrome.alarms.create("meta-check", { periodInMinutes: CHECK_MINUTES })
  refresh().catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  applySettings()
  refresh().catch(() => {})
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "meta-check") refresh().catch(() => {})
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) applySettings()
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
    refresh(true)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: String(err.message ?? err) }))
    return true
  }
})
