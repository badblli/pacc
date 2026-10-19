const $ = (id) => document.getElementById(id)
const I18n = window.PacI18n
const t = (key, vars) => I18n.t(key, vars)
let downloading = false

// data-i18n="anahtar" taşıyan öğelerin metnini seçili dilde yazar
function applyText() {
  document.documentElement.lang = I18n.lang
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n)
  document.title = t("app.name")
  $("refresh").textContent = t(downloading ? "popup.downloading" : "popup.refresh")
}

async function load() {
  const { settings = {}, meta, metaError } = await chrome.storage.local.get(["settings", "meta", "metaError"])
  $("uiLang").value = ["en", "tr"].includes(settings.uiLang) ? settings.uiLang : "auto"
  // Kurulumda background.js dile göre yazar; ayar hiç yoksa aynı kural (Türkçe arayüz → çeviri açık)
  $("translation").checked = settings.translation ?? I18n.resolveLang(settings.uiLang) === "tr"
  $("panel").checked = settings.panel !== false
  $("overlay").checked = settings.overlay !== false
  $("poolTracking").checked = settings.poolTracking === true
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
$("panel").addEventListener("change", (e) => save({ panel: e.target.checked }))
$("overlay").addEventListener("change", (e) => save({ overlay: e.target.checked }))
$("poolTracking").addEventListener("change", (e) => save({ poolTracking: e.target.checked }))

$("refresh").addEventListener("click", async () => {
  const btn = $("refresh")
  btn.disabled = true
  downloading = true
  btn.textContent = t("popup.downloading")
  await chrome.runtime.sendMessage({ type: "refresh-meta" })
  downloading = false
  btn.disabled = false
  btn.textContent = t("popup.refresh")
  load()
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
