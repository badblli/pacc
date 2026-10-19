// Oyun sayfasına item / meta panelini ekler. Panel shadow DOM içinde çalışır,
// böylece oyunun stilleri ve klavye kısayolları birbirine karışmaz.
// Panel sadece bilgi gösterir; oyunda hiçbir şeye tıklamaz veya hamle yapmaz.

;(() => {
  if (window.__pacYardimci) return
  window.__pacYardimci = true

  // Eklenti yeniden yüklenince açık sekmedeki bu betik "Extension context invalidated" hatası verir.
  // Tüm chrome.* çağrıları bu korumalardan geçer; bağlam öldüyse panel kendini kaldırır.
  const extAlive = () => {
    try {
      return Boolean(chrome.runtime?.id)
    } catch {
      return false
    }
  }
  const ext = (path) => {
    try {
      return extAlive() ? chrome.runtime.getURL(path) : ""
    } catch {
      return ""
    }
  }
  const loadJson = (path) => fetch(ext(path)).then((r) => r.json())

  async function safeCall(fn, fallback) {
    if (!extAlive()) {
      shutdown()
      return fallback
    }
    try {
      return await fn()
    } catch {
      if (!extAlive()) shutdown()
      return fallback
    }
  }
  const store = {
    get: (keys) => safeCall(() => chrome.storage.local.get(keys), {}),
    set: (obj) => safeCall(() => chrome.storage.local.set(obj), undefined)
  }
  const sendBg = (msg) => safeCall(() => chrome.runtime.sendMessage(msg), null)

  const state = {
    tab: "game",
    game: null,
    health: null,
    healthAt: 0,
    lastGame: null,
    open: {},
    query: "",
    item: null,
    settings: { panel: true, tier: "LEVEL_BALL", minGames: 50, poolTracking: false },
    meta: null,
    metaError: null,
    tr: null,
    data: null
  }

  // ---------- yardımcılar ----------

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

  const itemName = (k) => state.tr?.item?.[k] ?? k
  const pkmName = (k) => state.tr?.pkm?.[k] ?? k
  const synName = (k) => state.tr?.synergy?.[k] ?? k
  const tierName = (k) => state.tr?.elorank?.[k] ?? k
  const healthFresh = () => Date.now() - state.healthAt < 3500
  const gameReady = () => Boolean(state.game && state.health?.status === "ok" && healthFresh())

  function healthLabel() {
    if (!healthFresh()) return state.healthAt ? "Oyun bağlantısı kesildi" : "Oyun bağlantısı bekleniyor"
    if (state.health.status === "error") return "Oyun durumu okunamadı"
    if (state.health.status === "idle") return state.health.inGame ? "Tahta henüz okunamadı" : "Oyun bekleniyor"
    if (!state.game) return "Tahta henüz okunamadı"
    const active = state.game.board?.filter((p) => p.y > 0).length ?? 0
    return `Tahta okundu · ${active} Pokémon · ${Math.floor((Date.now() - state.healthAt) / 1000)} sn önce`
  }

  const itemIcon = (k, cls = "item-icon") =>
    `<img class="${cls}" src="/assets/item/${esc(k)}.png" alt="${esc(itemName(k))}" title="${esc(itemName(k))}" data-item="${esc(k)}">`

  function portrait(k, cls = "portrait") {
    const idx = state.data?.pkmIndex?.[k]
    if (!idx) return `<div class="${cls}"></div>`
    return `<img class="${cls}" src="/assets/portraits/${esc(idx.replace("-", "/"))}/Normal.png" alt="" loading="lazy">`
  }

  function place(rank) {
    const cls = rank <= 3.5 ? "good" : rank <= 4.5 ? "mid" : "bad"
    return `<span class="place ${cls}" title="Ortalama sıralama (1 en iyi, 8 en kötü)">${rank.toFixed(2)}</span>`
  }

  const fmt = (n) => Number(n).toLocaleString("tr-TR")

  // Oyunun açıklamalarındaki BÜYÜK_HARF kalıplarını okunur etiketlere çevirir.
  let tokenRe = null
  function buildTokenRe() {
    const t = state.tr
    const keys = [
      ...Object.keys(t.stat ?? {}),
      ...Object.keys(t.status ?? {}),
      ...Object.keys(t.synergy ?? {}),
      ...Object.keys(t.damage ?? {}),
      ...Object.keys(t.technical_terms ?? {}).filter((k) => k !== "title"),
      ...Object.keys(t.item ?? {}),
      "GOLD"
    ].sort((a, b) => b.length - a.length)
    tokenRe = new RegExp(`(?<![\\w])(?:${keys.join("|")})(?![\\w])|\\[[^\\]]+\\]`, "g")
  }

  function renderDesc(text) {
    if (!text) return ""
    const t = state.tr
    return esc(text).replace(tokenRe, (tok) => {
      if (tok.startsWith("[")) {
        const parts = tok.slice(1, -1).split(",")
        const luck = parts.some((p) => p.startsWith("LK"))
        const ap = parts.some((p) => p.startsWith("SP"))
        const values = parts.filter((p) => !/^(LK|SP|ND)/.test(p)).join("/")
        return `<span class="tok">${values}${luck ? " 🍀" : ""}${ap ? " ✦" : ""}</span>`
      }
      if (t.stat?.[tok]) return `<span class="tok">${esc(t.stat[tok])}</span>`
      if (t.status?.[tok]) return `<span class="tok status">${esc(t.status[tok])}</span>`
      if (t.damage?.[tok]) return `<span class="tok dmg">${esc(t.damage[tok])}</span>`
      if (t.synergy?.[tok]) return `<span class="tok syn">${esc(t.synergy[tok])}</span>`
      if (t.technical_terms?.[tok]) return `<i>${esc(t.technical_terms[tok])}</i>`
      if (t.item?.[tok]) return `<span class="tok">${esc(t.item[tok])}</span>`
      if (tok === "GOLD") return "altın"
      return tok
    })
  }

  const itemDesc = (k) => renderDesc(state.tr?.item_description?.[k])

  function recipeHtml(k) {
    const r = state.data?.recipes?.[k]
    if (!r) return ""
    return `<span class="row muted">${itemIcon(r[0])} + ${itemIcon(r[1])}</span>`
  }

  const tierPokemons = () => state.meta?.pokemons?.[state.settings.tier] ?? {}
  const tierItems = () => state.meta?.items?.[state.settings.tier] ?? {}

  // ---------- sekmeler ----------

  // Arama için ad katlama: büyük/küçük harf, Türkçe i/ı/İ, aksanlar ve ayraçlar (_ - ' boşluk) yok sayılır.
  // Böylece "chari", "CHARIZARD", "mr mime", "Farfetch'd" hepsi eşleşir.
  const foldCache = new Map()
  function fold(s) {
    const text = String(s ?? "")
    let out = foldCache.get(text)
    if (out === undefined) {
      out = text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ı/g, "i")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
      foldCache.set(text, out)
    }
    return out
  }

  const HIDDEN_PKM = new Set(["DEFAULT", "EGG", "SUBSTITUTE"])
  const SEARCH_LIMIT = 40
  const familyRoot = (k) => state.data?.family?.[k] ?? k

  // Aile kökü -> üyeler. static.json'da data.family (üye -> ilk hal) ve data.pokemons[ad][1] (aşama) var.
  let familyIndexFor = null
  let familyIndex = null
  function familyOf(k) {
    if (familyIndexFor !== state.data) {
      familyIndexFor = state.data
      familyIndex = new Map()
      for (const m of Object.keys(state.data?.pokemons ?? {})) {
        const root = familyRoot(m)
        if (!familyIndex.has(root)) familyIndex.set(root, [])
        familyIndex.get(root).push(m)
      }
    }
    return familyIndex.get(familyRoot(k)) ?? [k]
  }

  // Evrim şeridi: küçük portre + ad + ★ sayısı, aşamaya göre sıralı; dallanmalar (Eevee) aynı aşamada yan yana.
  // cur = kartın kendi Pokémon'u, hit = aramayla bulunan aşama.
  function evoStrip(k, q = "") {
    const members = familyOf(k)
    if (members.length < 2 || members.length > 12) return ""
    const stages = new Map()
    for (const m of members) {
      const t = pkmStars(m) || 1
      if (!stages.has(t)) stages.set(t, [])
      stages.get(t).push(m)
    }
    const html = [...stages.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([t, list]) => `<div class="evo-stage">${list
          .map(
            (m) => `<div class="evo-mon${m === k ? " cur" : ""}${nameHit(m, q) ? " hit" : ""}" data-pkm="${esc(m)}" title="${esc(pkmName(m))} — ${t}. aşama">
              ${portrait(m, "portrait sm")}
              <div class="evo-name">${esc(pkmName(m))}</div>
              <div class="stars">${"★".repeat(t)}</div>
            </div>`
          )
          .join("")}</div>`
      )
      .join(`<span class="evo-arrow" aria-hidden="true">›</span>`)
    return `<div class="evo" role="group" aria-label="Evrim zinciri">${html}</div>`
  }
  const pkmStars = (k) => state.data?.pokemons?.[k]?.[1] ?? 0
  const pkmTypes = (k) => state.data?.pokemons?.[k]?.[2] ?? []

  // Aranabilir tüm Pokémon anahtarları: static.json'daki hepsi + meta'da olup static'te olmayanlar.
  // Meta kaydı olmayan (az oynanan, seçili elo'da hiç görülmeyen) Pokémonlar da aranabilir.
  function allPokemonKeys() {
    const keys = new Set(Object.keys(state.data?.pokemons ?? {}))
    for (const k of Object.keys(tierPokemons())) keys.add(k)
    for (const k of HIDDEN_PKM) keys.delete(k)
    return keys
  }

  // 0 = ad tam eşleşir, 1 = ad aramayla başlar, 2 = adın içinde geçer, 3 = aile adıyla eşleşir, null = eşleşmez
  function matchScore(k, q) {
    const names = [fold(pkmName(k)), fold(k)]
    if (names.some((n) => n === q)) return 0
    if (names.some((n) => n.startsWith(q))) return 1
    if (names.some((n) => n.includes(q))) return 2
    // Ailenin herhangi bir üyesi eşleşiyorsa tüm aile gelir ("charizard" → Charmander, Charmeleon da çıkar)
    for (const m of familyOf(k)) {
      if (m !== k && (fold(pkmName(m)).includes(q) || fold(m).includes(q))) return 3
    }
    return null
  }

  // Ad aramayla doğrudan eşleşiyor mu (evrim şeridinde "bulunan" aşamayı işaretlemek için)
  const nameHit = (k, q) => Boolean(q) && (fold(pkmName(k)).includes(q) || fold(k).includes(q))

  function searchPokemons(q) {
    const tier = tierPokemons()
    const out = []
    for (const k of allPokemonKeys()) {
      const score = matchScore(k, q)
      if (score !== null) out.push({ k, score, meta: tier[k] ?? null })
    }
    out.sort(
      (a, b) =>
        a.score - b.score ||
        (a.score === 3
          ? fold(pkmName(familyRoot(a.k))).localeCompare(fold(pkmName(familyRoot(b.k)))) || pkmStars(a.k) - pkmStars(b.k)
          : (b.meta?.[1] ?? 0) - (a.meta?.[1] ?? 0)) ||
        pkmName(a.k).localeCompare(pkmName(b.k), "tr")
    )
    return out
  }

  const typeChips = (k) =>
    pkmTypes(k)
      .map((s) => `<span class="chip"><img src="/assets/types/${esc(s)}.svg" alt="">${esc(synName(s))}</span>`)
      .join("")

  // Seçili elo'da kaydı olmayan Pokémon için: veri olan ilk (en düşük) elo seviyesini bul
  function otherTierHint(k) {
    for (const [tier, list] of Object.entries(state.meta?.pokemons ?? {})) {
      if (tier !== state.settings.tier && list[k]?.[1] > 0) return `${esc(tierName(tier))} ve üstünde ${fmt(list[k][1])} oyun var.`
    }
    return ""
  }

  function pokemonCard({ k, score, meta }, q) {
    const stars = pkmStars(k)
    const tag = score === 3 ? `<span class="tag">${esc(pkmName(familyRoot(k)))} ailesi</span>` : ""
    const head = (stat) => `<div class="row">
        ${portrait(k, "portrait lg")}
        <div class="grow">
          <div class="name">${esc(pkmName(k))}${stars ? ` <span class="stars" title="${stars}. aşama">${"★".repeat(stars)}</span>` : ""} ${tag}</div>
          <div class="chips tight">${typeChips(k)}</div>
          ${stat}
        </div>
      </div>
      ${evoStrip(k, q)}`

    if (!meta) {
      const hint = otherTierHint(k)
      return `<div class="card nometa">${head(`<div class="stats"><span class="stat warn">Meta verisi yok</span></div>`)}
        <div class="note-line">${state.meta ? `Bu elo seviyesinde yeterli oyunu yok. ${hint}` : "Meta verisi henüz yüklenmedi."}</div>
      </div>`
    }

    const [rank, count, itemCount, items] = meta
    const lowSample = count < state.settings.minGames
    const comps = (state.meta?.clusters ?? [])
      .filter((c) => c.count >= state.settings.minGames && c.pokemons.some((p) => p.name === k && p.frequency >= 0.4))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
    const stat = `<div class="stats">
        <span class="stat" title="Ortalama sıralama (1 en iyi, 8 en kötü)">Sıra ${place(rank)}</span>
        <span class="stat">${fmt(count)} oyun</span>
        <span class="stat">ort. ${itemCount.toFixed(1)} item</span>
        ${lowSample ? `<span class="stat warn">⚠ az veri</span>` : ""}
      </div>`
    return `<div class="card">
      ${head(stat)}
      <div class="items">
        ${
          items.length
            ? items
                .map(
                  (it, i) => `<div class="item-line">${itemIcon(it)}<div class="text">
                    <div><b>${i + 1}. ${esc(itemName(it))}</b> ${recipeHtml(it)}</div>
                    <div class="desc">${itemDesc(it)}</div></div></div>`
                )
                .join("")
            : `<div class="muted">Bu Pokémon'a genelde item verilmiyor.</div>`
        }
      </div>
      ${
        comps.length
          ? `<div class="muted spaced">Sık görüldüğü dizilimler: ${comps
              .map((c) => `<a href="#" data-cluster="${esc(c.id)}">${clusterBadges(c)}</a>`)
              .join(" ")}</div>`
          : ""
      }
    </div>`
  }

  function metaStatusNote() {
    if (state.meta) return ""
    return state.metaError
      ? `<div class="empty err">Meta verisi alınamadı: ${esc(state.metaError)}</div>`
      : `<div class="empty">Meta verisi indiriliyor (ilk seferde ~40 MB, biraz sürebilir)...</div>`
  }

  // Sadece sonuç alanı; arama kutusu yeniden çizilmez, böylece yazarken odak kaybolmaz.
  function pokemonResults() {
    const q = fold(state.query)
    let list
    let total
    if (q) {
      const found = searchPokemons(q)
      total = found.length
      list = found.slice(0, SEARCH_LIMIT)
    } else {
      list = Object.entries(tierPokemons())
        .sort((a, b) => b[1][1] - a[1][1])
        .slice(0, 20)
        .map(([k, meta]) => ({ k, score: 0, meta }))
      total = list.length
    }
    const intro = q
      ? `${total} sonuç${total > list.length ? ` (ilk ${list.length} gösteriliyor, aramayı daralt)` : ""}. Meta'sı olmayanlar notla birlikte listelenir.`
      : "Seçili elo seviyesinde en çok kullanılan 3 item. Arama yoksa en çok oynanan 20 Pokémon gösterilir."
    return `${metaStatusNote()}<div class="note">${intro}</div>
      ${list.map((r) => pokemonCard(r, q)).join("") || `<div class="empty">"${esc(state.query.trim())}" için sonuç yok</div>`}`
  }

  function viewPokemon() {
    return `<input type="search" placeholder="Pokémon ara (ör. Gyarados, chari, Charmander)" value="${esc(state.query)}" data-role="query" autocomplete="off" spellcheck="false" aria-label="Pokémon ara">
      <div data-role="results">${pokemonResults()}</div>`
  }

  function clusterTitle(c) {
    return Object.entries(c.synergies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([s, n]) => `${synName(s)} ${n}`)
      .join(" / ")
  }

  // Dizilim adı: oyunun sinerji ikonları + sayı (en çok 3 sinerji). Ad title/alt'ta; names=true ise küçük yazıyla da görünür.
  function clusterBadges(c, names = false) {
    const top = Object.entries(c.synergies ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    if (!top.length) return `<span class="syn-badges">Dizilim</span>`
    return `<span class="syn-badges" title="${esc(clusterTitle(c))}">${top
      .map(
        ([s, n]) =>
          `<span class="syn-badge"><img src="/assets/types/${esc(s)}.svg" alt="${esc(synName(s))}" title="${esc(synName(s))} ${n}"><b>${n}</b>${
            names ? `<small>${esc(synName(s))}</small>` : ""
          }</span>`
      )
      .join("")}</span>`
  }

  // owned: (Pkm) => boolean — elinde olan birimleri ✓ ile işaretlemek için
  // Meta hep son evrimi söyler ("Charizard") ama dükkanda / tahtada ilk hali görünür ("Charmander").
  // Üyenin altında bu yüzden "dükkanda: Charmander" (ya da elindeki evre için "elinde: ...") ipucu çıkar.
  // showHint=false: rakip gibi dükkanla ilgisi olmayan listelerde ipucu gösterilmez.
  function teamHtml(members, owned, board = null, showHint = true) {
    return `<div class="team">${members
      .map((m) => {
        const family = familyRoot(m.name)
        const current = board?.find((p) => p.y > 0 && familyRoot(p.name) === family)
          ?? board?.find((p) => familyRoot(p.name) === family)
        const shown = current?.name ?? family
        const hint = showHint && shown !== m.name
        const path = shown === m.name ? pkmName(shown) : `${pkmName(shown)} → ${pkmName(m.name)}`
        return `<div class="member${owned?.(m.name) ? " owned" : ""}" data-pkm="${esc(m.name)}" title="${esc(path)}${m.frequency ? ` — takımların %${Math.round(m.frequency * 100)}'inde` : ""}">
          ${portrait(m.name, "portrait sm")}
          <div class="mini-items">${(m.items ?? []).slice(0, 3).map((it) => itemIcon(it)).join("")}</div>
          <div class="label">${esc(pkmName(m.name))}</div>
          ${
            hint
              ? `<div class="shop-hint">${portrait(shown, "portrait xs")}<span>${current ? "elinde" : "dükkanda"}: ${esc(pkmName(shown))}</span></div>`
              : ""
          }
        </div>`
      })
      .join("")}</div>`
  }

  function viewComps() {
    const list = (state.meta?.clusters ?? [])
      .filter((c) => c.count >= state.settings.minGames)
      .sort((a, b) => a.rank - b.rank)

    const cards = list.map((c, i) => {
      const syn = Object.entries(c.synergies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s, n]) => `<span class="chip"><img src="/assets/types/${esc(s)}.svg" alt="">${esc(synName(s))} ${n}</span>`)
        .join("")
      const core = c.pokemons.filter((p) => p.frequency >= 0.45).slice(0, 9)
      const top = c.topTeams[0]
      return `<div class="card" id="cluster-${esc(c.id)}">
        <div class="row wrap">
          <div class="grow"><b class="comp-title">#${i + 1}</b> ${clusterBadges(c)}</div>
          <div class="muted">Ort. ${place(c.rank)} · 1.lik %${c.winrate.toFixed(0)} · ${fmt(c.count)} oyun</div>
        </div>
        <div class="chips">${syn}</div>
        ${teamHtml(core, null, [])}
        ${
          top
            ? `<details><summary>Örnek takım (${esc(top.rank)}. bitirdi, ${esc(top.elo)} elo)</summary>${teamHtml(top.pokemons, null, [])}</details>`
            : ""
        }
      </div>`
    })

    return `<div class="note">Son oyunlardaki takımlar sinerjilerine göre gruplanmış. Ortalama sırası en iyiden kötüye. Ana kadroda o gruptaki takımların en az %45'inde olan Pokémonlar var; altlarında en çok kullanılan itemleri görürsün. En az ${state.settings.minGames} oyunu olan dizilimler listeleniyor.</div>
      ${cards.join("") || `<div class="empty">Bu filtreyle dizilim yok</div>`}`
  }

  function viewItems() {
    const { components, recipes } = state.data
    const byPair = {}
    for (const [item, [a, b]] of Object.entries(recipes)) {
      byPair[`${a}|${b}`] = item
      byPair[`${b}|${a}`] = item
    }
    let grid = `<div class="cell head"></div>${components.map((c) => `<div class="cell head">${itemIcon(c)}</div>`).join("")}`
    for (const a of components) {
      grid += `<div class="cell head">${itemIcon(a)}</div>`
      for (const b of components) {
        const it = byPair[`${a}|${b}`]
        grid += `<div class="cell${it && it === state.item ? " sel" : ""}">${it ? itemIcon(it) : ""}</div>`
      }
    }

    const stats = tierItems()
    let detail = ""
    if (state.item) {
      const k = state.item
      const s = stats[k]
      detail = `<div class="card">
        <div class="row">${itemIcon(k, "item-icon lg")}<div class="grow"><div class="name">${esc(itemName(k))}</div>${recipeHtml(k)}</div>
          ${s ? `<div class="muted">Ort. ${place(s[0])}<br>${fmt(s[1])} kullanım</div>` : ""}</div>
        <div class="desc" style="margin-top:6px">${itemDesc(k)}</div>
        ${s?.[2]?.length ? `<div class="muted" style="margin-top:8px">En çok kullanan Pokémonlar:</div>${teamHtml(s[2].map((name) => ({ name })))}` : ""}
      </div>`
    }

    const best = Object.entries(stats)
      .filter(([k, s]) => recipes[k] && s[1] >= state.settings.minGames)
      .sort((a, b) => a[1][0] - b[1][0])
      .slice(0, 15)
      .map(
        ([k, s]) => `<div class="item-line" style="margin-bottom:6px">${itemIcon(k)}<div class="text">
          <b>${esc(itemName(k))}</b> <span class="muted">· ort. ${place(s[0])} · ${fmt(s[1])} kullanım</span>
          <div class="desc">${itemDesc(k)}</div></div></div>`
      )
      .join("")

    return `${detail}
      <div class="note">Tarif tablosu: satır + sütun parçası = sonuç. Bir iteme tıklayınca detayı açılır.</div>
      <div class="grid">${grid}</div>
      <div class="card"><b>Taşıyanı en iyi bitiren itemler</b>
        <div class="note">Item taşıyan Pokémonların ortalama sırası. Güçlü taşıyıcılara giden itemler burada daha iyi görünür, bunu da hesaba kat.</div>
        ${best}</div>`
  }

  // ---------- Oyunum (canlı öneriler) ----------

  const STATE_LABEL = {
    have: ["Elinde hazır", "ok"],
    craftable: ["Şimdi yapabilirsin", "ok"],
    "one-missing": ["1 parça eksik", "warn"],
    far: ["2 parça eksik", "muted"],
    none: ["Özel item", "muted"]
  }

  const RARITY_SHORT = { COMMON: "Yaygın", UNCOMMON: "Az yaygın", RARE: "Nadir", EPIC: "Epik", ULTRA: "Ultra" }

  const pct = (p) => (p >= 0.995 ? "%100" : p < 0.005 && p > 0 ? "<%1" : `%${Math.round(p * 100)}`)

  function reasonText(r) {
    if (r.kind === "next") return `${synName(r.syn)} bir sonraki seviyeye çıkar`
    if (r.kind === "syn") return `${synName(r.syn)} sinerjine katkı`
    return "önerilen dizilimde var"
  }

  // Açılır bölüm. Panel her saniye yeniden çizildiği için açık/kapalı durumunu state.open'da tutuyoruz.
  function section(id, title, body, { open = false, hl = false, badge = "" } = {}) {
    const isOpen = state.open[id] ?? open
    return `<details class="card sec${hl ? " hl" : ""}" data-sec="${id}"${isOpen ? " open" : ""}>
      <summary><b>${title}</b>${badge ? ` <span class="badge">${badge}</span>` : ""}</summary>
      <div class="sec-body">${body}</div></details>`
  }

  function unitLine(pkm, extra) {
    return `<div class="item-line">${portrait(pkm, "portrait sm")}<div class="text"><b data-pkm="${esc(pkm)}">${esc(pkmName(pkm))}</b>${
      extra ? ` <span class="muted">${extra}</span>` : ""
    }</div></div>`
  }

  function advisorCtx() {
    return {
      data: state.data,
      tierPokemons: tierPokemons(),
      tierItems: tierItems(),
      clusters: state.meta?.clusters ?? [],
      minGames: state.settings.minGames,
      thresholds: state.meta?.thresholds ?? null,
      names: { pkm: pkmName, syn: synName, item: itemName }
    }
  }

  function quickReason(snap) {
    const advice = window.PacAdvisor.boardAdvice(advisorCtx(), snap)
    const choice = advice.choice
    const best = choice?.options.find((option) => option.verdict === "best")
    if (best?.reasons.length) {
      const key = choice.kind === "pokemon" ? snap.choices[0].pokemons[best.index] : snap.choices[0].items[best.index]
      const name = choice.kind === "pokemon" ? pkmName(key) : itemName(key)
      return `<div class="quick-reason"><b>Öneri: ${esc(name)}</b><span>${best.reasons.slice(0, 2).map(esc).join(" · ")}</span></div>`
    }
    const shop = advice.shop.find((option) => option.verdict === "good" && option.reasons.length)
    if (!shop) return ""
    return `<div class="quick-reason"><b>Dükkanda: ${esc(pkmName(snap.shop[shop.index]))}</b><span>${shop.reasons.slice(0, 2).map(esc).join(" · ")}</span></div>`
  }

  function viewLastGame() {
    const last = state.lastGame
    if (!last?.snap) return ""
    const s = window.PacAdvisor.summarize(advisorCtx(), last.snap)
    const date = new Date(last.at).toLocaleString("tr-TR")
    const rankText = s.rank ? `${s.rank}. oldun` : "sıralama okunamadı"
    const compLine = s.comp
      ? `<div class="row"><div class="grow">En çok benzeyen dizilim: <a href="#" data-cluster="${esc(s.comp.cluster.id)}">${clusterBadges(s.comp.cluster, true)}</a></div>
         <div class="muted">bu dizilim ort. ${place(s.comp.cluster.rank)} bitiriyor</div></div>`
      : ""
    const units = s.units
      .map((u) => {
        const missing = u.recommended.filter((it) => !u.unit.items.includes(it)).slice(0, 2)
        return `<div class="unit"><div class="row">${portrait(u.unit.name, "portrait sm")}<div class="grow"><b>${esc(pkmName(u.unit.name))}</b>
          <span class="muted">${"★".repeat(u.unit.stars || 1)}</span></div><div class="held">${u.unit.items.map((it) => itemIcon(it)).join("")}</div></div>
          ${
            missing.length && u.unit.items.length < 3
              ? `<div class="muted indent">Meta'da sık kullanılan: ${missing.map((it) => itemIcon(it)).join("")}</div>`
              : ""
          }</div>`
      })
      .join("")
    return `<div class="card hl"><b>Son oyunun — ${esc(rankText)}</b> <span class="muted">(${esc(date)})</span>
      ${compLine}
      <div class="note">Taktığın ${s.held} itemin ${s.matched} tanesi o Pokémon için meta'da en çok kullanılan 3 item arasında.</div>
      ${units}</div>`
  }

  function viewGame() {
    const snap = state.game
    if (!gameReady()) {
      return `${viewLastGame()}<div class="empty">${esc(healthLabel())}.<br><br>Tahta yeniden okununca öneriler otomatik görünecek.</div>`
    }
    const a = window.PacAdvisor.analyze(advisorCtx(), snap)
    const owned = (p) => a.mineFamilies.has(a.familyOf(p))
    const onBoard = snap.board.filter((p) => p.y > 0).length
    const parts = []

    parts.push(`<div class="status">Aşama ${esc(snap.stage)} · Seviye ${esc(snap.level ?? "?")} · ${esc(snap.money)} altın · ❤ ${esc(snap.life ?? "?")} · Tahtada ${onBoard}, yedekte ${
      snap.board.length - onBoard
    }${snap.inventory ? ` · Elde ${snap.inventory.length} item` : ""}</div>`)
    parts.push(quickReason(snap))

    // --- acil seçimler en üstte ---
    if (a.pokemonPropositions.length) {
      parts.push(
        section(
          "pick",
          "Pokémon seçimi — önerilen sıra",
          a.pokemonPropositions
            .map((p, i) => {
              const best = p.best ? `meta'da ${esc(pkmName(p.best.name))} ort. ${place(p.best.rank)}` : ""
              const why = [best, ...p.reasons.map((r) => esc(reasonText(r)))].filter(Boolean).join(" · ")
              return `<div class="item-line">${p.members.map((m) => portrait(m, "portrait sm")).join("")}<div class="text">
                <b>${i + 1}. ${p.members.map((m) => esc(pkmName(m))).join(" & ")}</b><div class="desc">${why || "Takımına belirgin bir katkısı yok"}</div></div></div>`
            })
            .join(""),
          { open: true, hl: true, badge: "Şimdi seç" }
        )
      )
    }

    if (a.propositions.length) {
      parts.push(
        section(
          "itempick",
          "Item seçimi — önerilen sıra",
          `<div class="items">${a.propositions
            .map(
              (p, i) => `<div class="item-line">${itemIcon(p.item)}<div class="text">
                <b>${i + 1}. ${esc(itemName(p.item))}</b>
                <div class="desc">${p.reason ? esc(p.reason) : "Tahtandaki Pokémonlar için hazır kullanım bulunamadı"}</div>
                <div class="desc">${itemDesc(p.item)}</div></div></div>`
            )
            .join("")}</div>`,
          { open: true, hl: true, badge: "Şimdi seç" }
        )
      )
    }

    if (a.craft.length) {
      parts.push(
        section(
          "craft",
          "Elindeki parçalarla hemen yap",
          `<div class="items">${a.craft
            .map(
              (c) => `<div class="item-line">${itemIcon(c.item)}<div class="text"><b>${esc(itemName(c.item))}</b>
                <span class="muted">(${esc(itemName(c.recipe[0]))} + ${esc(itemName(c.recipe[1]))}) → ${esc(pkmName(c.for))}</span></div></div>`
            )
            .join("")}</div>`,
          { open: true, hl: true, badge: a.craft.length }
        )
      )
    }

    // --- ekonomi ---
    const e = a.economy
    const odds = (probs) =>
      probs
        .map((p, i) => (p > 0 ? `<span class="chip">${RARITY_SHORT[state.data.rules.shopRarities[i]]} ${pct(p)}</span>` : ""))
        .join("")
    parts.push(
      section(
        "eco",
        "Ekonomi",
        `<div class="muted">Sonraki tur geliri: <b>+${e.income}</b> (5 taban + ${e.interest} faiz + ${e.streakBonus} seri)${
          e.xpLeft ? ` · Seviye için ${e.xpLeft} XP (${e.levelCost} altın)` : ""
        }</div>
        ${e.tips.map(([kind, text]) => `<div class="tip ${kind}">${esc(text)}</div>`).join("")}
        <div class="muted" style="margin-top:6px">Seviye ${esc(snap.level)} dükkan oranları:</div><div class="chips">${odds(e.probs)}</div>
        ${e.nextProbs.length && snap.level < (snap.maxLevel ?? 9) ? `<div class="muted">Seviye ${snap.level + 1} olunca:</div><div class="chips">${odds(e.nextProbs)}</div>` : ""}`,
        { open: true, badge: `+${e.income}` }
      )
    )

    // --- sinerjiler ---
    if (a.synergies.length) {
      const rows = a.synergies
        .filter((s) => s.tier > 0 || s.need <= 2)
        .slice(0, 10)
        .map((s) => {
          const bar = s.steps.map((t) => `<span class="step${t <= s.count ? " on" : ""}">${t}</span>`).join("")
          const hint = s.need
            ? `${s.need} ${synName(s.syn)} daha → seviye ${s.tier + 1}${
                s.fromBench.length ? ` · yedekten sahaya koy: ${s.fromBench.map((p) => esc(pkmName(p))).join(", ")}` : ""
              }${s.fromShop.length ? ` · dükkanda: ${s.fromShop.map((p) => esc(pkmName(p))).join(", ")}` : ""}`
            : "en üst seviyede"
          return `<div class="syn-row"><img src="/assets/types/${esc(s.syn)}.svg" alt=""><b>${esc(synName(s.syn))} ${s.count}</b>
            <span class="steps">${bar}</span><div class="desc">${hint}</div></div>`
        })
        .join("")
      if (rows) parts.push(section("syn", "Sinerjiler", rows, { open: true }))
    } else if (!state.meta?.thresholds) {
      parts.push(`<div class="note">Sinerji eşikleri henüz yüklenmedi; panelin altındaki ⟳ ile veriyi yenile.</div>`)
    }

    if (a.shop.length) {
      parts.push(
        section(
          "shop",
          "Dükkanda işine yarayanlar",
          `<div class="items">${a.shop.map((s) => unitLine(s.pkm, `(${s.slot + 1}. sıra) — ${esc(s.reasons.join(", "))}`)).join("")}</div>`,
          { open: true, badge: a.shop.length }
        )
      )
    }

    // --- rakip ---
    if (a.opponent) {
      const o = a.opponent
      parts.push(
        section(
          "opp",
          `Rakip: ${esc(o.name || "?")}`,
          `<div class="muted">❤ ${esc(o.life ?? "?")} · Tahtada ${o.size} Pokémon</div>
          <div class="chips">${o.synergies
            .map((s) => `<span class="chip"><img src="/assets/types/${esc(s.syn)}.svg" alt="">${esc(synName(s.syn))} ${s.count}</span>`)
            .join("")}</div>
          ${o.carries.length ? `<div class="muted">En çok itemli Pokémonları:</div>${teamHtml(o.carries, null, null, false)}` : ""}`,
          { open: false, badge: o.synergies[0] ? esc(synName(o.synergies[0].syn)) : "" }
        )
      )
    }

    if (a.comps.length) {
      parts.push(
        section(
          "comps",
          "Sana uyan dizilimler",
          `<div class="note">Elindeki Pokémonlar (evrimleri dahil) ve dükkanın meta dizilimlerle eşleştirildi. ✓ işaretliler elinde var.</div>
          ${a.comps
            .map(
              (r) => `<div class="sub">
                <div class="row"><div class="grow"><a href="#" data-cluster="${esc(r.cluster.id)}">${clusterBadges(r.cluster, true)}</a></div>
                <div class="muted">%${Math.round(r.overlap * 100)} eşleşme · ort. ${place(r.cluster.rank)}</div></div>
                ${teamHtml(r.core.slice(0, 9), owned, snap.board)}
              </div>`
            )
            .join("")}`,
          { open: true }
        )
      )
    }

    // --- havuz ---
    if (state.settings.poolTracking) {
      parts.push(
        section(
          "pool",
          "Havuz ve dükkanda çıkma ihtimali",
          a.pool.length
            ? `<div class="note">Her yenilemede dükkanda en az bir tane çıkma ihtimali. Tüm oyuncuların tahtaları sayıldı; başkalarının dükkanındakiler görünmediği için yaklaşık.</div>
              ${a.pool
                .map((r) =>
                  unitLine(
                    r.base,
                    `${r.why === "elinde" ? `elinde ${r.mine}/${r.need} kopya` : "dizilim için"} · havuzda ${r.remaining}/${r.size} · ${r.possible ? `yenileme başına <b>${pct(r.pShop)}</b>` : `${esc(RARITY_SHORT[r.rarity] ?? r.rarity)}: bu seviyede çıkmaz`}`
                  )
                )
                .join("")}`
            : `<div class="muted">Takip edilecek Pokémon yok.</div>`
        )
      )
    }

    // --- bölge ---
    if (a.regional.length) {
      const mapName = state.tr?.map?.[snap.map] ?? snap.map ?? ""
      parts.push(
        section(
          "region",
          `Bölgesel Pokémonlar${mapName ? ` — ${esc(mapName)}` : ""}`,
          a.regional
            .map((r) => {
              const best = r.best ? `meta'da ort. ${place(r.best.rank)}` : ""
              return unitLine(r.pkm, [best, ...r.reasons.map((x) => esc(reasonText(x)))].filter(Boolean).join(" · "))
            })
            .join("")
        )
      )
    }

    // --- item önerisi ---
    if (a.items.length) {
      parts.push(
        section(
          "items",
          "Pokémonlarına item önerisi",
          `${snap.inventory ? "" : `<div class="note">Elindeki parçalar okunamadı, sadece öneriler gösteriliyor.</div>`}
          ${a.items
            .map((u) => {
              const held = u.unit.items.map((it) => itemIcon(it)).join("")
              return `<div class="unit${u.unit.y === 0 ? " bench" : ""}">
                <div class="row">${portrait(u.unit.name, "portrait sm")}
                  <div class="grow"><b>${esc(pkmName(u.unit.name))}</b> <span class="muted">${"★".repeat(u.unit.stars || 1)}${u.unit.y === 0 ? " · yedek" : ""}${
                    u.source && u.source !== u.unit.name ? ` · ${esc(pkmName(u.source))} verisi` : ""
                  }</span></div>
                  <div class="held">${held}</div></div>
                ${
                  u.recs.length
                    ? `<div class="recs">${u.recs
                        .map((r) => {
                          const [label, cls] = STATE_LABEL[r.state]
                          return `<span class="rec ${cls}" title="${esc(itemName(r.item))}${
                            r.missing ? ` — eksik: ${r.missing.map(itemName).join(", ")}` : ""
                          }">${itemIcon(r.item)}<span><b>${esc(itemName(r.item))}</b> · ${esc(label)}</span></span>`
                        })
                        .join("")}</div>`
                    : `<div class="muted">Veri yok ya da önerilen itemlerin hepsi takılı.</div>`
                }
              </div>`
            })
            .join("")}`,
          { open: true }
        )
      )
    }

    return parts.join("")
  }

  // ---------- çerçeve ----------

  let dead = false
  let queryTimer = null
  let gameRenderTimer = null
  let tick = null

  const host = document.createElement("div")
  host.id = "pac-yardimci"
  const root = host.attachShadow({ mode: "open" })

  // Panelde yazarken oyunun kısayolları (D = yenile, F = XP al...) tetiklenmesin.
  for (const type of ["keydown", "keyup", "keypress"]) {
    host.addEventListener(type, (e) => e.stopPropagation())
  }

  root.innerHTML = `<style id="css"></style>
    <button class="launcher" title="PAC Koç (Alt+P)"><img src="${ext("icons/icon-48.png")}" alt="PAC Koç"></button>
    <section class="panel" hidden>
      <header>
        <img class="logo" src="${ext("icons/icon-48.png")}" alt=""><span class="title">PAC Koç</span>
        <span class="health" data-role="health"></span>
        <button class="icon-btn" data-role="close" title="Kapat" aria-label="Kapat">✕</button>
      </header>
      <nav>
        <button data-tab="game">Oyunum</button>
        <button data-tab="pokemon">Pokémon</button>
        <button data-tab="comps">Dizilimler</button>
        <button data-tab="items">Itemler</button>
      </nav>
      <main></main>
      <footer></footer>
      <div class="grip nw" data-grip="nw" title="Boyutlandır"></div>
      <div class="grip se" data-grip="se" title="Boyutlandır"></div>
    </section>`

  // Bulunamayan portre / ikonları gizle (sayfanın CSP kuralı inline onerror'a izin vermeyebilir)
  root.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") e.target.style.visibility = "hidden"
  }, true)

  const panel = root.querySelector(".panel")
  const launcher = root.querySelector(".launcher")
  const main = root.querySelector("main")
  const footer = root.querySelector("footer")
  const health = root.querySelector('[data-role="health"]')

  function updateHealth() {
    health.textContent = healthLabel()
    health.classList.toggle("ok", gameReady())
  }

  // Arama kutusu odaktayken yeniden çizim olursa imleci ve odağı geri ver.
  function queryFocus() {
    const a = root.activeElement
    return a?.dataset?.role === "query" ? [a.selectionStart, a.selectionEnd] : null
  }

  function restoreQueryFocus(keep) {
    if (!keep) return
    const input = main.querySelector('[data-role="query"]')
    if (!input) return
    input.focus({ preventScroll: true })
    try {
      input.setSelectionRange(keep[0], keep[1])
    } catch {}
  }

  function render() {
    if (dead) return
    updateHealth()
    for (const b of root.querySelectorAll("nav button")) b.classList.toggle("active", b.dataset.tab === state.tab)
    if (!state.tr || !state.data) {
      main.innerHTML = `<div class="empty">Yükleniyor...</div>`
      return
    }
    // Pokémon araması meta olmadan da çalışır (static.json'daki tüm Pokémonlar listelenir)
    if (!state.meta && state.tab !== "pokemon") {
      main.innerHTML = state.metaError
        ? `<div class="empty err">Meta verisi alınamadı: ${esc(state.metaError)}</div>`
        : `<div class="empty">Meta verisi indiriliyor (ilk seferde ~40 MB, biraz sürebilir)...</div>`
    } else {
      const scroll = main.scrollTop
      const keep = queryFocus()
      const views = { game: viewGame, pokemon: viewPokemon, comps: viewComps, items: viewItems }
      main.innerHTML = views[state.tab]()
      main.scrollTop = scroll
      restoreQueryFocus(keep)
    }
    renderFooter()
  }

  function renderFooter() {
    const tiers = Object.keys(state.meta?.pokemons ?? {})
    const date = state.meta?.createdAt ? new Date(state.meta.createdAt).toLocaleDateString("tr-TR") : "—"
    footer.innerHTML = `
      <label>Elo: <select data-role="tier">${tiers
        .map((t) => `<option value="${esc(t)}"${t === state.settings.tier ? " selected" : ""}>${esc(tierName(t))} ve üstü</option>`)
        .join("")}</select></label>
      <label>Min. oyun: <select data-role="min">${[10, 30, 50, 100, 200]
        .map((n) => `<option${n === state.settings.minGames ? " selected" : ""}>${n}</option>`)
        .join("")}</select></label>
      <span class="grow"></span>
      <span title="Son ${fmt(state.meta?.games ?? 0)} oyundan">Veri: ${date}</span>
      <button class="icon-btn" data-role="refresh" title="Veriyi yenile" aria-label="Veriyi yenile">⟳</button>`
  }

  async function saveSettings(patch) {
    state.settings = { ...state.settings, ...patch }
    const { settings } = await store.get("settings")
    await store.set({ settings: { ...settings, ...patch } })
  }

  // ---------- konum ve boyut (panelBox) ----------

  const BOX_MIN = { width: 320, height: 300 }
  let box = null // { left, top, width, height } — null ise varsayılan (sağ alt) konum

  const viewport = () => ({
    w: document.documentElement.clientWidth || window.innerWidth,
    h: document.documentElement.clientHeight || window.innerHeight
  })

  function defaultBox() {
    const v = viewport()
    const width = Math.min(440, v.w - 32)
    const height = Math.max(BOX_MIN.height, Math.min(Math.round(v.h * 0.72), v.h - 88))
    return { left: v.w - 16 - width, top: Math.max(8, v.h - 72 - height), width, height }
  }

  // Panel her zaman ekranın içinde kalsın, en küçük/en büyük boyut sınırları içinde olsun
  function clampBox(b) {
    const v = viewport()
    const width = Math.min(Math.max(b.width, Math.min(BOX_MIN.width, v.w)), v.w)
    const height = Math.min(Math.max(b.height, Math.min(BOX_MIN.height, v.h)), v.h)
    return {
      width,
      height,
      left: Math.min(Math.max(b.left, 0), v.w - width),
      top: Math.min(Math.max(b.top, 0), v.h - height)
    }
  }

  function applyBox() {
    const b = clampBox(box ?? defaultBox())
    panel.style.left = `${b.left}px`
    panel.style.top = `${b.top}px`
    panel.style.width = `${b.width}px`
    panel.style.height = `${b.height}px`
    panel.style.right = "auto"
    panel.style.bottom = "auto"
    return b
  }

  const saveBox = () => store.set({ panelBox: box })

  function toggle(force) {
    panel.hidden = force === undefined ? !panel.hidden : !force
    if (!panel.hidden) {
      applyBox()
      render()
    }
  }

  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-item],[data-pkm],[data-cluster],[data-tab],[data-role],.launcher")
    if (!el) return
    if (el.classList.contains("launcher")) return toggle()
    if (el.dataset.tab) {
      state.tab = el.dataset.tab
      main.scrollTop = 0
      return render()
    }
    if (el.dataset.item) {
      state.item = el.dataset.item
      state.tab = "items"
      render()
      main.scrollTop = 0
      return
    }
    if (el.dataset.pkm) {
      state.query = pkmName(el.dataset.pkm)
      state.tab = "pokemon"
      render()
      main.scrollTop = 0
      return
    }
    if (el.dataset.cluster) {
      e.preventDefault()
      state.tab = "comps"
      render()
      root.getElementById(`cluster-${el.dataset.cluster}`)?.scrollIntoView({ block: "start" })
      return
    }
    if (el.dataset.role === "close") return toggle(false)
    if (el.dataset.role === "refresh") {
      el.disabled = true
      sendBg({ type: "refresh-meta" }).then(() => (el.disabled = false))
    }
  })

  root.addEventListener(
    "toggle",
    (e) => {
      const sec = e.target.dataset?.sec
      if (sec) state.open[sec] = e.target.open
    },
    true
  )

  // Sadece sonuç alanını yeniden çiz: arama kutusu yerinde kalır, odak ve imleç kaybolmaz.
  root.addEventListener("input", (e) => {
    if (e.target.dataset.role !== "query") return
    state.query = e.target.value
    clearTimeout(queryTimer)
    queryTimer = setTimeout(() => {
      const results = main.querySelector('[data-role="results"]')
      if (!results) return
      results.innerHTML = pokemonResults()
      main.scrollTop = 0
    }, 80)
  })

  root.addEventListener("change", (e) => {
    // Arama kutusunun "change" olayı (Enter / odak kaybı) yeniden çizime yol açmasın; tıklamayı yutardı.
    if (e.target.dataset.role === "tier") saveSettings({ tier: e.target.value })
    else if (e.target.dataset.role === "min") saveSettings({ minGames: Number(e.target.value) })
    else return
    render()
  })

  // Paneli başlığından sürükle
  const header = root.querySelector("header")
  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return
    const r = applyBox()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    try {
      header.setPointerCapture(e.pointerId)
    } catch {}
    const move = (ev) => {
      box = clampBox({ ...r, left: ev.clientX - dx, top: ev.clientY - dy })
      applyBox()
    }
    const up = () => {
      header.removeEventListener("pointermove", move)
      header.removeEventListener("pointerup", up)
      header.removeEventListener("pointercancel", up)
      saveBox()
    }
    header.addEventListener("pointermove", move)
    header.addEventListener("pointerup", up)
    header.addEventListener("pointercancel", up)
  })

  // Köşelerden boyutlandır: sol-üst köşe sağ-alt sabit kalır, sağ-alt köşe sol-üst sabit kalır
  for (const grip of root.querySelectorAll(".grip")) {
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      const corner = grip.dataset.grip
      const r = applyBox()
      const right = r.left + r.width
      const bottom = r.top + r.height
      const v = viewport()
      try {
        grip.setPointerCapture(e.pointerId)
      } catch {}
      const move = (ev) => {
        if (corner === "se") {
          const width = Math.min(Math.max(ev.clientX - r.left, BOX_MIN.width), v.w - r.left)
          const height = Math.min(Math.max(ev.clientY - r.top, BOX_MIN.height), v.h - r.top)
          box = { left: r.left, top: r.top, width, height }
        } else {
          const left = Math.min(Math.max(ev.clientX, 0), right - BOX_MIN.width)
          const top = Math.min(Math.max(ev.clientY, 0), bottom - BOX_MIN.height)
          box = { left, top, width: right - left, height: bottom - top }
        }
        applyBox()
      }
      const up = () => {
        grip.removeEventListener("pointermove", move)
        grip.removeEventListener("pointerup", up)
        grip.removeEventListener("pointercancel", up)
        saveBox()
      }
      grip.addEventListener("pointermove", move)
      grip.addEventListener("pointerup", up)
      grip.addEventListener("pointercancel", up)
    })
  }

  const onResize = () => {
    if (!panel.hidden) applyBox()
  }
  window.addEventListener("resize", onResize)

  // game-hook.js (sayfa içi) her değişiklikte takım özetini yollar
  const onGameMessage = (e) => {
    if (e.source !== window || e.data?.type !== "pac-yardimci:game") return
    const wasInGame = Boolean(state.game)
    const prev = state.game
    state.game = e.data.snapshot
    // Oyun bitince son durumu sakla (oyun sonu özeti için)
    if (wasInGame && !state.game && prev?.board?.length) {
      state.lastGame = { snap: prev, at: Date.now() }
      store.set({ lastGame: state.lastGame })
    }
    launcher.classList.toggle("live", Boolean(state.game))
    if (!wasInGame && state.game) state.tab = "game"
    if (panel.hidden || state.tab !== "game") return
    // Panelde bir şey yazarken / bir yere bakarken sürekli yeniden çizmemek için hafif gecikme
    clearTimeout(gameRenderTimer)
    gameRenderTimer = setTimeout(render, 300)
  }
  window.addEventListener("message", onGameMessage)

  const onHealthMessage = (e) => {
    if (e.source !== window || e.data?.type !== "pac-yardimci:health") return
    if (!["ok", "idle", "error"].includes(e.data.status)) return
    const wasReady = gameReady()
    state.health = { status: e.data.status, inGame: e.data.inGame === true }
    state.healthAt = Date.now()
    updateHealth()
    if (wasReady !== gameReady() && !panel.hidden && state.tab === "game") render()
  }
  window.addEventListener("message", onHealthMessage)

  tick = setInterval(() => {
    if (!extAlive()) return shutdown()
    const wasOk = health.classList.contains("ok")
    updateHealth()
    if (wasOk && !gameReady() && !panel.hidden && state.tab === "game") render()
  }, 1000)

  function onRuntimeMessage(msg) {
    if (msg?.type === "toggle-panel" && state.settings.panel) toggle()
  }

  function onStorageChanged(changes, area) {
    if (area !== "local") return
    if (changes.meta) state.meta = changes.meta.newValue
    if (changes.metaError) state.metaError = changes.metaError.newValue
    if (changes.settings) {
      state.settings = { ...state.settings, ...changes.settings.newValue }
      host.style.display = state.settings.panel ? "" : "none"
      if (!panel.hidden) render()
    }
    if (!panel.hidden && (changes.meta || changes.metaError)) render()
  }

  try {
    chrome.runtime.onMessage.addListener(onRuntimeMessage)
    chrome.storage.onChanged.addListener(onStorageChanged)
  } catch {
    shutdown()
  }

  // Eklenti yeniden yüklendi / kaldırıldı: paneli sayfadan sök, zamanlayıcıları ve dinleyicileri bırak.
  function shutdown() {
    if (dead) return
    dead = true
    clearInterval(tick)
    clearTimeout(queryTimer)
    clearTimeout(gameRenderTimer)
    window.removeEventListener("message", onGameMessage)
    window.removeEventListener("message", onHealthMessage)
    window.removeEventListener("resize", onResize)
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage)
      chrome.storage.onChanged.removeListener(onStorageChanged)
    } catch {}
    host.remove()
    window.__pacYardimci = false
    console.info("[PAC Koç] Eklenti yeniden yüklendi; bu sekmedeki panel kaldırıldı. Sayfayı yenile.")
  }

  async function init() {
    if (!extAlive()) return shutdown()
    document.documentElement.appendChild(host)
    window.postMessage({ type: "pac-yardimci:hello" }, location.origin)
    let loaded
    try {
      loaded = await Promise.all([
        fetch(ext("content/panel.css")).then((r) => r.text()),
        loadJson("locales/tr/translation.json"),
        loadJson("data/static.json"),
        store.get(["settings", "meta", "metaError", "lastGame", "panelBox"])
      ])
    } catch (err) {
      if (!extAlive()) return shutdown()
      throw err
    }
    if (dead) return
    const [css, tr, data, stored] = loaded
    root.getElementById("css").textContent = css
    state.tr = tr
    state.data = data
    state.settings = { ...state.settings, ...stored.settings }
    state.meta = stored.meta ?? null
    state.metaError = stored.metaError ?? null
    state.lastGame = stored.lastGame ?? null
    const b = stored.panelBox
    if (b && [b.left, b.top, b.width, b.height].every(Number.isFinite)) box = clampBox(b)
    applyBox()
    host.style.display = state.settings.panel ? "" : "none"
    buildTokenRe()
    if (!state.meta) {
      sendBg({ type: "get-meta" }).then((res) => {
        if (res?.error) state.metaError = res.error
        if (res?.meta) state.meta = res.meta
        if (!panel.hidden) render()
      })
    }
    render()
  }

  init()
})()
