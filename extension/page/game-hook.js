// Sayfanın kendi JS ortamında (MAIN world) çalışır. Oyunun Redux store'unu ve
// Colyseus oyun durumunu yakalar, SADECE senin takımının özetini panelin
// content script'ine postMessage ile yollar. Oyuna mesaj göndermez, hiçbir şeyi değiştirmez.
//
// Neden iki kaynak?
//  - Redux store: kullanıcı id'si, dükkan, karusel/item seçenekleri, tahta (canlı).
//  - Colyseus GameState: eldeki takılmamış item parçaları (player.items) sadece burada canlı.
//  - Phaser sahnesi: tahtadaki Pokémon ve item ikonlarının ekran konumları (ayrı 250 ms "pac-yardimci:screen" mesajı).

;(() => {
  if (window.__pacYardimciHook) return
  window.__pacYardimciHook = true

  const MSG = "pac-yardimci:game"
  let store = null

  // ---- 1) Redux store ----
  // configureStore({ devTools: true }) yüklenirken window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  // fonksiyonunu kullanır. Araya kendi "enhancer"ımızı ekleyip store'u yakalıyoruz.
  // Redux DevTools eklentisi kuruluysa onun fonksiyonunu da zincire bağlıyoruz.
  const compose = (...fns) => (fns.length === 0 ? (x) => x : fns.reduce((a, b) => (...args) => a(b(...args))))
  const capture = (createStore) => (...args) => {
    store = createStore(...args)
    return store
  }
  let devtoolsCompose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  function hookedCompose(...args) {
    if (args.length === 0) return undefined
    if (typeof args[0] === "object") {
      const inner = devtoolsCompose ? devtoolsCompose(...args) : compose
      return (...enhancers) => inner(...enhancers, capture)
    }
    return (devtoolsCompose ?? compose)(...args, capture)
  }
  try {
    Object.defineProperty(window, "__REDUX_DEVTOOLS_EXTENSION_COMPOSE__", {
      configurable: true,
      get: () => hookedCompose,
      set: (v) => {
        if (v !== hookedCompose) devtoolsCompose = v
      }
    })
  } catch {}

  // Yedek yol: kanca kaçırıldıysa (ör. sayfa zaten yüklüyse) React ağacındaki
  // <Provider store={...}> bileşeninden store'u bul.
  function findStoreInReact() {
    const rootEl = document.getElementById("root") ?? document.body.firstElementChild
    const key = rootEl && Object.keys(rootEl).find((k) => k.startsWith("__reactContainer$"))
    let fiber = key ? rootEl[key] : null
    const stack = fiber ? [fiber] : []
    let guard = 0
    while (stack.length && guard++ < 5000) {
      const f = stack.pop()
      const s = f.memoizedProps?.store
      if (s && typeof s.getState === "function") return s
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return null
  }

  // ---- 2) Colyseus GameState ----
  // Colyseus decoder kök durumu refs.set(0, state) ile kaydeder. Map.set'i sadece
  // anahtar 0 olduğunda kontrol eden ince bir sarmalayıcıyla bu nesneyi yakalıyoruz.
  const roots = []
  const origSet = Map.prototype.set
  Map.prototype.set = function (key, value) {
    if (key === 0 && value !== null && typeof value === "object") {
      roots.push(new WeakRef(value))
      if (roots.length > 8) roots.shift()
    }
    return origSet.call(this, key, value)
  }

  // ---- 3) Phaser oyunu (tahta üstü konumlar için) ----
  // Oyun Phaser'ı paketin içine gömüyor; Phaser.Game nesnesi global değil. Phaser.Game kurucusu
  // `this.domContainer = null` atıyor: Object.prototype'a tek seferlik bir setter koyup ilk atamada
  // nesneyi yakalıyor, değeri hemen o nesnenin kendi alanı yapıyoruz (oyunun davranışı değişmez).
  // Yakalayınca tuzağı kaldırıyoruz; oyun kapanınca (SPA'da yeni maça geçiş) tekrar kuruyoruz.
  // Getter undefined döndürür: ilgisiz nesnelerde okuma sonucu değişmez.
  let gameRef = null
  let armed = false
  function disarm() {
    if (!armed) return
    armed = false
    try {
      delete Object.prototype.domContainer
    } catch {}
  }
  function arm() {
    if (armed) return
    try {
      Object.defineProperty(Object.prototype, "domContainer", {
        configurable: true,
        enumerable: false,
        get: () => undefined,
        set(value) {
          try {
            Object.defineProperty(this, "domContainer", { value, writable: true, enumerable: true, configurable: true })
          } catch {}
          try {
            // Sadece Phaser.Game'e benzeyen nesneyi al: kurucu bu noktada yalnız config (Phaser Config:
            // sceneConfig/renderType alanları) ve renderer'ı atamış olur
            const cfg = this?.config
            if (cfg && typeof cfg === "object" && ("sceneConfig" in cfg || "renderType" in cfg) && "renderer" in this) {
              gameRef = new WeakRef(this)
              disarm()
            }
          } catch {}
        }
      })
      armed = true
    } catch {}
  }
  arm()

  function phaserGame() {
    const g = gameRef?.deref()
    if (g && !g.pendingDestroy && g.canvas?.isConnected !== false) return g
    if (g) gameRef = null
    // Oyun yoksa sıradaki Phaser.Game için tuzağı yeniden kur
    arm()
    // Yedek: Phaser'ın hata ayıklama kurulumu window.PHASER_GAME bırakabilir
    const dbg = window.PHASER_GAME
    return dbg?.canvas?.isConnected ? dbg : null
  }

  function gameState() {
    for (let i = roots.length - 1; i >= 0; i--) {
      const s = roots[i].deref()
      try {
        if (s?.players?.get && s.simulations && s.floatingItems) return s
      } catch {}
    }
    return null
  }

  // ---- özet ----
  const toArray = (coll) => {
    const out = []
    try {
      if (typeof coll?.forEach === "function") coll.forEach((v) => out.push(v))
      else if (coll && typeof coll === "object") out.push(...Object.values(coll))
    } catch {}
    return out
  }

  const toObject = (coll) => {
    const out = {}
    try {
      if (typeof coll?.forEach === "function") coll.forEach((v, k) => { out[k] = v })
      else if (coll && typeof coll === "object") Object.assign(out, coll)
    } catch {}
    return out
  }

  function snapshot() {
    if (!store) store = findStoreInReact()
    const st = store?.getState?.()
    const uid = st?.network?.uid
    const game = st?.game
    if (!uid || !game) return null
    // Oyun bittikten sonra (/after) ya da tekrar izlerken (/replay) Redux'ta eski oyun kalır; sadece /game'de oku
    if (!location.pathname.startsWith("/game")) return null

    const gs = gameState()
    const live = gs?.players?.get?.(uid)
    const reduxPlayer = game.players?.find?.((p) => p.id === uid)
    const player = live ?? reduxPlayer
    if (!player) return null

    const unitsOf = (pl) =>
      toArray(pl?.board).map((p) => ({
        name: p.name,
        x: p.positionX,
        y: p.positionY,
        stars: p.stars,
        items: toArray(p.items),
        types: toArray(p.types)
      }))

    const xp = game.experienceManager ?? player.experienceManager ?? {}
    const choices = toArray(live?.choices ?? reduxPlayer?.choices).map((c) => ({
      id: c.id,
      type: c.type,
      pokemons: toArray(c.pokemons),
      items: toArray(c.items),
      costs: toArray(c.costs)
    }))
    const pokemonChoice = choices.find((c) => c.pokemons.length > 0)
    const itemChoice = choices.find((c) => c.type === "item")

    // Sıradaki / şu anki rakip: oyunda tahtasına tıklayarak zaten görebildiğin bilgi
    const oppId = player.opponentId
    const opp = oppId ? (gs?.players?.get?.(oppId) ?? game.players?.find?.((p) => p.id === oppId)) : null

    // Havuz hesabı için tüm oyuncuların tahtalarındaki kopya sayısı (1★=1, 2★=3, 3★=9)
    const taken = {}
    const allPlayers = gs ? toArray(gs.players) : (game.players ?? [])
    for (const pl of allPlayers) {
      toArray(pl?.board).forEach((p) => {
        const copies = p.stars >= 3 ? 9 : p.stars === 2 ? 3 : 1
        taken[p.name] = (taken[p.name] ?? 0) + copies
      })
    }

    return {
      uid,
      stage: game.stageLevel,
      phase: game.phase,
      money: game.money ?? player.money,
      life: player.life,
      rank: player.rank,
      alive: player.alive,
      streak: game.streak ?? player.streak,
      interest: game.interest ?? player.interest,
      maxInterest: game.maxInterest ?? player.maxInterest ?? 5,
      level: xp.level,
      experience: xp.experience,
      expNeeded: xp.expNeeded,
      maxLevel: xp.maxLevel,
      map: player.map,
      regionalPokemons: toArray(player.regionalPokemons),
      additionalPokemons: toArray(gs?.additionalPokemons ?? game.additionalPokemons),
      board: unitsOf(player),
      // takılmamış itemler: sadece canlı GameState'te güvenilir
      inventory: live ? toArray(live.items) : null,
      shop: toArray(game.shop),
      choices,
      itemsProposition: itemChoice?.items ?? toArray(game.itemsProposition),
      pokemonsProposition: pokemonChoice?.pokemons ?? toArray(game.pokemonsProposition).map((p) => (typeof p === "string" ? p : toArray(p))),
      synergies: toObject(player.synergies),
      opponent: opp
        ? {
            id: oppId,
            name: player.opponentName || opp.name,
            life: opp.life,
            board: unitsOf(opp),
            synergies: toObject(opp.synergies)
          }
        : null,
      players: allPlayers.length,
      taken
    }
  }

  // ---- tahta üstü ekran konumları (sadece kendi tahtan) ----
  // Dünya koordinatı → kamera (scrollX/Y, zoom, origin) → oyun boyutu (game.scale) → canvas'ın sayfadaki dikdörtgeni.
  function screenInfo() {
    if (!location.pathname.startsWith("/game")) return null
    const g = phaserGame()
    const scene = g?.scene?.getScene?.("gameScene")
    const canvas = g?.canvas
    if (!scene || !canvas?.isConnected || scene.spectate) return null
    if (!store) store = findStoreInReact()
    const uid = store?.getState?.()?.network?.uid ?? scene.uid
    const board = scene.board
    if (!uid || !board?.pokemons || board.player?.id !== uid) return null

    const cam = scene.cameras?.main
    const box = canvas.getBoundingClientRect()
    const gw = g.scale?.width || canvas.width
    const gh = g.scale?.height || canvas.height
    if (!cam || !gw || !gh || box.width <= 0 || box.height <= 0) return null
    const zoom = cam.zoom || 1
    const sx = box.width / gw
    const sy = box.height / gh
    const ox = (cam.width ?? gw) * (cam.originX ?? 0.5)
    const oy = (cam.height ?? gh) * (cam.originY ?? 0.5)
    // Konteyner zincirini (parentContainer) yukarı doğru topla; döndürme yok sayılır
    const world = (obj) => {
      let x = obj.x
      let y = obj.y
      let s = 1
      for (let p = obj.parentContainer, n = 0; p && n < 8; p = p.parentContainer, n++) {
        x = p.x + x * (p.scaleX ?? 1)
        y = p.y + y * (p.scaleY ?? 1)
        s *= p.scaleX ?? 1
      }
      return { x, y, s }
    }
    const rectOf = (obj, fallback) => {
      const w = world(obj)
      if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) return null
      const cx = (cam.x ?? 0) + ox + (w.x - cam.scrollX - ox) * zoom
      const cy = (cam.y ?? 0) + oy + (w.y - cam.scrollY - oy) * zoom
      const width = (obj.width || fallback) * w.s * zoom * sx
      const height = (obj.height || fallback) * w.s * zoom * sy
      return {
        left: Math.round(box.left + cx * sx - width / 2),
        top: Math.round(box.top + cy * sy - height / 2),
        width: Math.round(width),
        height: Math.round(height)
      }
    }
    const shown = (obj) => obj && obj.active !== false && obj.visible !== false

    // index: snapshot'taki board sırası (aynı Pokémondan iki tane olabilir; id ile eşliyoruz)
    const live = gameState()?.players?.get?.(uid) ?? store?.getState?.()?.game?.players?.find?.((p) => p.id === uid)
    const order = new Map()
    toArray(live?.board).forEach((p, i) => order.set(p?.id, i))

    const units = []
    board.pokemons.forEach?.((sprite) => {
      if (!shown(sprite) || sprite.playerId !== uid) return
      const pkm = sprite.pokemon
      const index = order.get(pkm?.id ?? sprite.id)
      const rect = rectOf(sprite, 72)
      if (!rect || index === undefined) return
      units.push({ name: pkm?.name ?? sprite.name, x: pkm?.positionX, y: pkm?.positionY, index, rect })
    })

    const items = []
    const inv = scene.itemsContainer
    if (shown(inv) && inv.playerId === uid) {
      for (const child of inv.list ?? []) {
        if (!shown(child) || typeof child.name !== "string") continue
        const rect = rectOf(child, 60)
        if (rect) items.push({ item: child.name, rect })
      }
    }
    return { mode: board.mode ?? null, units, items }
  }

  let lastScreen = ""
  setInterval(() => {
    let screen = null
    try {
      screen = screenInfo()
    } catch {
      screen = null
    }
    const json = JSON.stringify(screen)
    // Konum varken her turda yolla (overlay bayatlığı ölçüyor); null'ı sadece değişince
    if (screen || json !== lastScreen) window.postMessage({ type: "pac-yardimci:screen", screen }, location.origin)
    lastScreen = json
  }, 250)

  let last = ""
  // Panel geç yüklenirse ilk özeti kaçırmasın: panel "hello" deyince son durumu yeniden yolla
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.type === "pac-yardimci:hello") last = ""
  })
  setInterval(() => {
    let snap = null
    let failed = false
    try {
      snap = snapshot()
    } catch (err) {
      failed = true
      console.debug("[PACC] durum okunamadı", err)
    }
    const json = JSON.stringify(snap)
    if (json !== last) {
      last = json
      window.postMessage({ type: MSG, snapshot: snap }, location.origin)
    }
    window.postMessage({
      type: "pac-yardimci:health",
      status: failed ? "error" : snap ? "ok" : "idle",
      inGame: location.pathname.startsWith("/game")
    }, location.origin)
  }, 1000)
})()
