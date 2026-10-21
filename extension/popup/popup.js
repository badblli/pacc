const $ = (id) => document.getElementById(id)
const I18n = window.PacI18n
const t = (key, vars) => I18n.t(key, vars)
let downloading = false

// data-i18n="anahtar" taşıyan öğelerin metnini seçili dilde yazar
function applyText() {
  document.documentElement.lang = I18n.lang
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n)
  document.title = t("app.name")
  // Açıklamalar satırda gizli; seçeneğin üzerine gelince ipucu olarak görünür
  for (const small of document.querySelectorAll(".opt small")) small.closest(".opt").title = small.textContent
  $("refresh").textContent = t(downloading ? "popup.downloading" : "popup.refresh")
}

// Daha yeni bir sürüm varsa üstte indirme bağlantısı (bilgi arka plan denetiminden gelir)
const newer = (a, b) => {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return false
}
async function showUpdate(settings) {
  const { update } = await chrome.storage.local.get("update")
  const link = $("update")
  const show = settings.updateCheck !== false && update?.version && newer(update.version, chrome.runtime.getManifest?.().version ?? "0.0.0") &&
    typeof update.url === "string" && update.url.startsWith("https://github.com/badblli/pacc/releases/")
  link.hidden = !show
  if (show) {
    link.href = update.url
    link.textContent = t("popup.updateAvailable", { version: update.version })
  }
}

async function load() {
  const { settings = {}, meta, metaError } = await chrome.storage.local.get(["settings", "meta", "metaError"])
  $("uiLang").value = ["en", "tr"].includes(settings.uiLang) ? settings.uiLang : "auto"
  // Kurulumda background.js dile göre yazar; ayar hiç yoksa aynı kural (Türkçe arayüz → çeviri açık)
  $("translation").checked = settings.translation ?? I18n.resolveLang(settings.uiLang) === "tr"
  $("panel").checked = settings.panel !== false
  $("alert").checked = settings.alert !== false
  $("updateCheck").checked = settings.updateCheck !== false
  await showUpdate(settings)
  $("alertSound").value = ["ball_catch", "chime"].includes(settings.alertSound) ? settings.alertSound : "level_up"
  $("planner").checked = settings.planner !== false
  $("overlay").checked = settings.overlay !== false
  $("poolTracking").checked = settings.poolTracking === true
  $("record").checked = settings.record === true
  await loadRecording()
  const status = $("status")
  status.classList.toggle("err", Boolean(metaError) && !meta)
  if (meta) {
    const date = new Date(meta.createdAt).toLocaleString(I18n.locale())
    status.textContent = t("popup.metaStatus", {
      date,
      games: t("num.games", { count: meta.games, n: I18n.number(meta.games) }),
      comps: meta.clusters.length
    })
  } else {
    status.textContent = metaError ? t("popup.metaError", { error: metaError }) : t("popup.metaNone")
  }
}

async function save(patch) {
  const { settings = {} } = await chrome.storage.local.get("settings")
  await chrome.storage.local.set({ settings: { ...settings, ...patch } })
}

$("uiLang").addEventListener("change", (e) => save({ uiLang: e.target.value }))
$("translation").addEventListener("change", (e) => save({ translation: e.target.checked }))
$("alert").addEventListener("change", (e) => save({ alert: e.target.checked }))
$("updateCheck").addEventListener("change", (e) => save({ updateCheck: e.target.checked }))
// Seçilen oyun sesini bir kez dinlet (oyunun sitesinden; çan yalnız oyunda çalar)
const GAME_SOUNDS = { level_up: "level_up.mp3", ball_catch: "ball_catch.ogg" }
$("alertSound").addEventListener("change", (e) => {
  save({ alertSound: e.target.value })
  const file = GAME_SOUNDS[e.target.value]
  if (file) {
    const preview = new Audio(`https://www.pokemon-auto-chess.com/pokechess/assets/audio/sounds/${file}`)
    preview.volume = 0.5
    preview.play().catch(() => {})
  }
})
$("panel").addEventListener("change", (e) => save({ panel: e.target.checked }))
$("planner").addEventListener("change", (e) => save({ planner: e.target.checked }))
$("overlay").addEventListener("change", (e) => save({ overlay: e.target.checked }))
$("poolTracking").addEventListener("change", (e) => save({ poolTracking: e.target.checked }))

$("refresh").addEventListener("click", async () => {
  const btn = $("refresh")
  btn.disabled = true
  downloading = true
  btn.textContent = t("popup.downloading")
  const res = await chrome.runtime.sendMessage({ type: "refresh-meta" })
  downloading = false
  btn.disabled = false
  btn.textContent = t("popup.refresh")
  await load()
  // Rapor değişmediyse hiçbir şey indirilmedi; bunu kullanıcıya söyle
  if (res?.ok && !res.updated) $("status").textContent += ` · ${t("popup.upToDate")}`
  if (res?.error) $("status").textContent = t("popup.metaError", { error: res.error })
})

// Dil seçici değişince (PacI18n storage'dan duyar) popup da hemen yeni dilde yazılır.
I18n.onChange(() => {
  applyText()
  load()
})

I18n.ready.then(() => {
  applyText()
  load()
})

// İndirme yalnız kullanıcının tıklamasıyla, ek izin istemeden başlar.
async function loadRecording() {
  const { gameRecording } = await chrome.storage.local.get("gameRecording")
  const n = gameRecording?.events?.length ?? 0
  $("downloadRecording").textContent = t("popup.downloadRecording", { n })
  $("downloadRecording").disabled = !n
  $("clearRecording").disabled = !n
  return gameRecording
}
$("record").addEventListener("change", (e) => save({ record: e.target.checked }))
$("downloadRecording").addEventListener("click", async () => {
  try {
    const recording = await loadRecording()
    if (!recording?.events?.length) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording)], { type: "application/json" }))
    const date = new Date(recording.recordedAt)
    const pad = (n) => String(n).padStart(2, "0")
    const a = document.createElement("a")
    a.href = url
    a.download = `pacc-game-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    $("recordError").textContent = ""
  } catch { $("recordError").textContent = t("popup.recordError") }
})
$("clearRecording").addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove("gameRecording")
    await loadRecording()
    $("recordError").textContent = ""
  } catch { $("recordError").textContent = t("popup.recordError") }
})
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.gameRecording) loadRecording()
})

// Popup açılınca arka plan denetimi tetiklenir (12 saat sınırı orada); sonuç gelince bant yenilenir
Promise.resolve(chrome.runtime.sendMessage?.({ type: "check-update" })).then(async () => {
  const { settings = {} } = await chrome.storage.local.get("settings")
  await showUpdate(settings)
}).catch(() => {})
