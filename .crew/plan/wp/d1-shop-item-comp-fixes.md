# d1-shop-item-comp-fixes — Dükkân, item birleşimi ve dizilim görselleri

- Summary: Dükkân önerileri somut takım katkısına dayanır; item seçiminde birleşim ve hedef Pokémon görünür; dizilimler tanınabilir ilk evrimleri gösterir.
- Engine: codex
- Phase: D1
- Branch: `codex/shop-item-comp-fixes` (base: `main` çalışma ağacındaki birleştirilmiş D1 değişiklikleri)
- Depends on: d1-advice-engine, d1-team-aware-advice, d1-live-advice-explainer
- Role: implementer

## Goal

Alakasız dükkân işaretlerini azaltmak ve item seçimi sırasında hemen uygulanabilir bir plan göstermek. Dizilimdeki Pokémonlar alışverişte tanınan formlarıyla gösterilsin.

## Scope

- In: `extension/content/advisor.js`, `extension/content/panel.js`, `extension/content/panel.css`, `tests/advice.test.mjs`, bu WP.
- Out: oyun kancası, overlay işaretleme mekanizması, popup, manifest, çeviri ve veri dosyaları.

## Tasks

1. Dükkânı oyuncunun sahasıyla örtüşen meta dizilimlerin eksik çekirdek Pokémonlarına göre işaretle. Sahadaki aile için evrim kopyasını da öner; sinerji eşiğini destekleyici gerekçe olarak göster. Sona ulaşmış aileye ve salt ortak türe öneri verme.
2. Item seçimindeki seçenek için eldeki bir parçayla tamamlanabilen tarif ve sahadaki uygun Pokémonu bul; birleşimi ve hedefi gerekçede açıkça yaz.
3. Dizilim kartlarında ilk evrim görselini/adını, elde varsa oyuncunun gerçek formunu göster; hedef son evrimi ayrıca belirt.
4. Bu durumları mevcut öneri testinde doğrula.

## Acceptance criteria

- [ ] Tek ortak türü olan ama eşik tamamlamayan dükkân adayı `good` olmaz.
- [ ] Sahaya dayanan meta dizilimin eksik çekirdeği ve yararlı evrim kopyası gerekçeyle `good` olur; tamamlanmış aile önerilmez.
- [ ] Item seçiminde eldeki parça + seçilecek parça birleşimi ve hedef Pokémon açık Türkçe gerekçedir; envanter yoksa birleşim kesinmiş gibi yazılmaz.
- [ ] Dizilimlerde ilk evrim, canlı takımda varsa mevcut form gösterilir; son evrim hedefi anlaşılır.
- [ ] `node tests/advice.test.mjs` ve AGENTS.md komutları geçer.
