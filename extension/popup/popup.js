const $ = (id) => document.getElementById(id)

async function load() {
  const { settings = {}, meta, metaError } = await chrome.storage.local.get(["settings", "meta", "metaError"])
  $("translation").checked = settings.translation !== false
  $("panel").checked = settings.panel !== false
  $("overlay").checked = settings.overlay !== false
  $("poolTracking").checked = settings.poolTracking === true
  const status = $("status")
  status.classList.toggle("err", Boolean(metaError) && !meta)
  if (meta) {
    const date = new Date(meta.createdAt).toLocaleString("tr-TR")
    status.textContent = `Meta raporu: ${date} · ${meta.games.toLocaleString("tr-TR")} oyun · ${meta.clusters.length} dizilim`
  } else {
    status.textContent = metaError ? `Veri alınamadı: ${metaError}` : "Meta verisi henüz indirilmedi."
  }
}

async function save(patch) {
  const { settings = {} } = await chrome.storage.local.get("settings")
  await chrome.storage.local.set({ settings: { ...settings, ...patch } })
}

$("translation").addEventListener("change", (e) => save({ translation: e.target.checked }))
$("panel").addEventListener("change", (e) => save({ panel: e.target.checked }))
$("overlay").addEventListener("change", (e) => save({ overlay: e.target.checked }))
$("poolTracking").addEventListener("change", (e) => save({ poolTracking: e.target.checked }))

$("refresh").addEventListener("click", async () => {
  const btn = $("refresh")
  btn.disabled = true
  btn.textContent = "İndiriliyor..."
  await chrome.runtime.sendMessage({ type: "refresh-meta" })
  btn.disabled = false
  btn.textContent = "Meta verisini şimdi yenile"
  load()
})

load()
