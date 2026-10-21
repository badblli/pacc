// Arka planda sıra geldiğinde yalnız ses ve başlıkla haber verir.
;(() => {
  let enabled = true
  // Oyunun kendi ses efektleri oyunun sitesinden çalınır (eklenti ses dosyası taşımaz); "chime" yerleşik çandır
  const SOUNDS = { level_up: "/pokechess/assets/audio/sounds/level_up.mp3", ball_catch: "/pokechess/assets/audio/sounds/ball_catch.ogg" }
  let sound = "level_up"
  const players = {}
  let previous = null
  let choiceId = null
  let lastAlert = -Infinity
  let audio = null
  let originalTitle = null
  let alertTitle = null
  const away = () => document.hidden || !document.hasFocus()

  function restoreTitle() {
    if (originalTitle === null) return
    // Oyun yeni bir başlık yazdıysa eski başlıkla üzerine yazma.
    if (document.title === alertTitle) document.title = originalTitle
    else if (document.title.startsWith(`${alertTitle} `)) document.title = document.title.slice(alertTitle.length + 1)
    originalTitle = alertTitle = null
  }

  async function prepareAudio() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext
      if (!audio && Context) audio = new Context()
      if (audio?.state === "suspended") await audio.resume()
    } catch {}
  }
  // Context yalnız gerçek kullanıcı etkileşiminin içinde oluşturulur.
  window.addEventListener("pointerdown", prepareAudio, true)
  window.addEventListener("keydown", prepareAudio, true)

  async function chime() {
    const context = audio
    if (!context) return
    try {
      if (context.state === "suspended") await context.resume()
      if (context.state !== "running" || !enabled || !away()) return
      const start = context.currentTime
      for (const [offset, frequency] of [[0, 880], [0.16, 1174.66]]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(frequency, start + offset)
        gain.gain.setValueAtTime(0, start + offset)
        gain.gain.linearRampToValueAtTime(0.09, start + offset + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.24)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + 0.24)
      }
    } catch {}
  }

  // Oyun sesi çalınamazsa (ağ, autoplay) yerleşik çana düşer
  async function playSound() {
    if (sound === "chime" || typeof window.Audio !== "function") return chime()
    try {
      const player = players[sound] ??= new window.Audio(location.origin + SOUNDS[sound])
      player.volume = 0.5
      player.currentTime = 0
      await player.play()
    } catch {
      await chime()
    }
  }

  function notify() {
    if (!enabled || !away() || Date.now() - lastAlert < 3000) return
    lastAlert = Date.now()
    if (originalTitle === null || document.title !== alertTitle) originalTitle = document.title
    alertTitle = `🔔 ${window.PacI18n.t("popup.yourTurn")}`
    document.title = alertTitle
    void playSound()
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "pac-yardimci:game") return
    const snap = event.data.snapshot
    if (!snap) {
      previous = null
      choiceId = null
      restoreTitle()
      return
    }
    const id = snap.choices?.[0]?.id
    const trigger = (previous && previous.phase !== 0 && snap.phase === 0)
      || (id != null && id !== choiceId)
      || (snap.carousel && !previous?.carousel)
    if (id != null) choiceId = id
    previous = { phase: snap.phase, carousel: !!snap.carousel }
    if (trigger) notify()
  })
  document.addEventListener("visibilitychange", () => { if (!away()) restoreTitle() })
  window.addEventListener("focus", () => { if (!away()) restoreTitle() })

  function settingsChanged(settings = {}) {
    enabled = settings.alert !== false
    sound = settings.alertSound === "chime" || Object.hasOwn(SOUNDS, settings.alertSound) ? settings.alertSound : "level_up"
    if (!enabled) restoreTitle()
  }
  chrome.storage.local.get("settings").then(({ settings }) => settingsChanged(settings)).catch(() => {})
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) settingsChanged(changes.settings.newValue)
  })
})()
