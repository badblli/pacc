// Öncelik sırası sabittir; girdileri değiştirmeden en çok üç öneri seçer.
;(() => {
  function nowActions({ analysis = {}, board = {}, snap = {} } = {}) {
    const actions = []
    const add = (kind, title, detail = "") => actions.push({ kind, title, detail })
    const choice = board.choice
    if (choice) {
      const best = [...(choice.options ?? [])].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))[0]
      add("choice", choice.type || choice.kind, best?.reasons?.join(" · ") ?? "")
    } else if (analysis.pokemonPropositions?.length || analysis.propositions?.length) {
      add("choice", analysis.pokemonPropositions?.length ? "pokemon" : "item")
    }
    const craft = analysis.craft?.[0]
    if (craft) add("craft", craft.item, craft.for ?? "")
    const shop = analysis.shop?.[0]
    if (shop) add("shop", shop.pkm, shop.reasons?.join(" · ") ?? "")
    const placement = analysis.placement?.[0] ?? board.placement?.[0]
    if (placement) add("placement", placement.reason, placement.detail ?? "")
    // Birikim önerisi zaten durum çipinde gösterilir.
    const saving = Number.isFinite(snap.money) && snap.money < (snap.maxInterest ?? 5) * 10 && (snap.life ?? 100) > 30
    const eco = analysis.economy?.tips?.[0]
    if (eco && !saving) add("eco", eco[1])
    return actions.slice(0, 3)
  }
  window.PacNow = { nowActions }
})()
