// Yalnız açık geliştirici kaydını saklar; ham kimlikler belleğin dışına çıkmaz.
;(() => {
  const KEY = "gameRecording"
  const LIMIT = 8 * 1024 * 1024
  const fields = { game: "snapshot", screen: "screen", planner: "planner" }
  let enabled = false, recording = null, bytes = 0
  let queue = Promise.resolve()
  const previous = new Map(), aliases = new Map()
  let selfId = null
  const size = (value) => new TextEncoder().encode(JSON.stringify(value)).length + 1
  const empty = () => ({ format: 1, recordedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version, events: [] })
  function reset(value) {
    recording = value?.format === 1 && Array.isArray(value.events) ? value : empty()
    bytes = size(recording)
    previous.clear()
    aliases.clear()
    selfId = null
    for (const event of recording.events) previous.set(event.type, JSON.stringify(event.payload))
  }
  function alias(id) {
    if (typeof id === "string" && id.startsWith("ghost-")) return `ghost-${alias(id.slice(6))}`
    if (id === selfId || id === "self") return "self"
    if (!aliases.has(id)) aliases.set(id, `p${aliases.size % 7 + 1}`)
    return aliases.get(id)
  }
  function anonymous(value, player = false, lobbyIds = null) {
    if (Array.isArray(value)) return value.map((v) => anonymous(v, player, lobbyIds))
    if (!value || typeof value !== "object") return value
    if (value.uid) selfId = value.uid
    if (Array.isArray(value.lobby)) {
      lobbyIds = new Set(value.lobby.map((p) => p.id))
      // Rakip önce işlenirse de aynı eşleme kullanılsın; geçmişteki PvE kimlikleri oyuncu sayılmasın.
      if (value.opponent?.id) alias(value.opponent.id)
      for (const p of value.lobby) alias(p.id)
    }
    const identity = player ? alias(value.id ?? value.uid ?? value.name ?? "opponent") : "self"
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/avatar/i.test(key)).map(([key, v]) => {
      if (/^(uid|playerId|opponentId)$/i.test(key)) return [key, player || key === "opponentId" ? alias(v) : "self"]
      if ((player && /^(id|name|displayName|username)$/i.test(key)) || /^(playerName|opponentName|displayName|username)$/i.test(key)) return [key, identity]
      // Pokémon ve item adları korunur; oyuncu nesneleri ayrı ele alınır.
      if (key === "name" && !player && value.uid) return [key, "self"]
      if (key === "history" && Array.isArray(v)) return [key, v.map((id) => {
        const base = typeof id === "string" && id.startsWith("ghost-") ? id.slice(6) : id
        // Oyuncu dışı geçmiş yalnız uzaklığı etkiler; ham kimliğini saklama.
        return lobbyIds && !lobbyIds.has(base) && base !== selfId ? "pve" : alias(id)
      })]
      if (key === "doubleUpTeamId") return [key, v ? "team" : v]
      return [key, anonymous(v, /^(opponent|players|player|lobby)$/i.test(key), lobbyIds)]
    }))
  }
  // Performans: 8 MB'a varabilen kaydı her olayda yeniden yazmak oyunda takılmaya yol açar;
  // değişiklikleri 5 sn'de bir toplu kaydet (sekme kapanırken de bir kez dene)
  let saveTimer = null
  function scheduleSave() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      chrome.storage.local.set({ [KEY]: recording }).catch(() => {})
    }, 5000)
  }
  window.addEventListener("pagehide", () => {
    if (!saveTimer) return
    clearTimeout(saveTimer)
    saveTimer = null
    chrome.storage.local.set({ [KEY]: recording }).catch(() => {})
  })
  const ready = chrome.storage.local.get(["settings", KEY]).then((stored) => {
    enabled = stored.settings?.record === true
    reset(stored[KEY])
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    queue = queue.then(async () => {
      await ready
      if (changes.settings) enabled = changes.settings.newValue?.record === true
      if (changes[KEY]?.newValue === undefined && changes[KEY]) reset(null)
    }).catch(() => {})
  })
  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (typeof event.data?.type !== "string" || !event.data.type.startsWith("pac-yardimci:")) return
    const type = event.data.type.slice("pac-yardimci:".length)
    if (!Object.hasOwn(fields, type)) return
    // Performans: kayıt kapalıyken mesajı gezip anonimleştirme yapma (oyunda saniyede birkaç mesaj gelir)
    if (!enabled) return
    // Mesajı beklerken değişebilecek nesnelere referans tutma.
    const payload = anonymous(event.data[fields[type]] ?? null)
    const t = Date.now()
    queue = queue.then(async () => {
      await ready
      if (!enabled) return
      const json = JSON.stringify(payload)
      if (previous.get(type) === json) return
      const entry = { t, type, payload }, length = size(entry)
      if (length > LIMIT - 1024) return
      while (recording.events.length && bytes + length > LIMIT - 1024) {
        const removed = recording.events.shift()
        bytes -= size(removed)
        if (previous.get(removed.type) === JSON.stringify(removed.payload)) previous.delete(removed.type)
      }
      recording.events.push(entry)
      bytes += length
      previous.set(type, json)
      scheduleSave()
    }).catch(() => {})
  })
})()
