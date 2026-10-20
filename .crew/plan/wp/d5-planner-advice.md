# d5-planner-advice — Plana göre öneri motoru

- Summary: Öneri motoru, Takım Planlayıcısı'ndaki plana bakıp hangi meta dizilime yüzde kaç uyduğunu, eksik çekirdek birimleri, plana eklenebilecek önerilen Pokémonları (uyum yüzdesiyle) ve birim başına item planını hesaplar; bir meta dizilimi planlayıcı tahtasına dizer.
- Engine: codex
- Model: deep
- Phase: D5
- Branch: `codex/d5-planner-advice` (base: `main`)
- Depends on: none (d5-planner-bridge ve d5-planner-ui ile paralel; aşağıdaki API sözleşmedir)
- Role: implementer

## Goal

`extension/content/advisor.js` içindeki `window.PacAdvisor` nesnesine saf (DOM'suz) yeni fonksiyonlar eklenir. UI (d5-planner-ui) bunları çağıracak.

## API (sözleşme — isim ve şekilleri aynen kullan)

`ctx` mevcut advisor fonksiyonlarındaki ctx ile aynı (static data, tierPokemons, clusters, minGames, thresholds, t).
`plan` = `IDetailledPokemon[]` (`{name, x, y, items}`; oyunun planlayıcı biçimi).

1. `PacAdvisor.planFit(ctx, plan)` →
   `{ best: [{cluster, fit: 0..100, owned: [pkm], missing: [pkm]}...en fazla 3], synergies: [{syn, count, next, need}], missing: [{pkm, why}] }`
   - Eşleştirme evrim ailesine göre (mevcut `familyOf`), ağırlık cluster çekirdek frekansı; `fit` = sahip olunan çekirdek ağırlığı / toplam × 100, yuvarlanmış.
   - Sinerji sayımı oyunun kuralıyla: tahtadaki (y≥1) her AİLE tiplerini bir kez sayar; item'ların verdiği tipleri (stone/gem vb., static data'da varsa) ekle.
2. `PacAdvisor.planRecommendations(ctx, plan, {limit = 10} = {})` → `[{pkm, fit: 0..100, reasons: [{kind, syn?}], rarity}]`
   - Aday: en iyi 3 dizilimin plandaki aileler dışındaki çekirdek birimleri + plandaki sinerjileri bir sonraki eşiğe taşıyan dükkan Pokémonları.
   - `fit`: dizilim katkısı + sinerji eşiği katkısı + meta ortalama sıra katkısı; 0..100'e normalize; açıklama `reasons` mevcut `reasonText` biçimiyle uyumlu (kind: "comp" | "next" | "syn" | "meta").
3. `PacAdvisor.planItems(ctx, plan)` → `[{pkm, items: [Item ×3], have: [Item]}]` (her birim için meta'da en çok kullanılan 3 item; `have` = planda takılı olanlar).
4. `PacAdvisor.compToPlan(ctx, cluster, {keepPlan = null} = {})` → `IDetailledPokemon[]`
   - Çekirdek birimleri (frekansa göre en fazla 8) en son evrim formunda (static data'daki aile + meta'da en çok oynanan form) tahtaya diz: tank/ön saf (yüksek HP/DEF ya da menzil 1) y=3 (rakibe en yakın), diğerleri y=2..1; x ortalanmış; her birime meta item'ları (en fazla 3).
   - `keepPlan` verilirse: plandaki birimleri yerinde bırak, sadece eksikleri boş karelere ekle ("Sadece eksikleri ekle").
5. Tüm fonksiyonlar hata yerine boş sonuç döner (meta yoksa vb.).

## Scope

- In: `extension/content/advisor.js`, `tests/advice.test.mjs` (yeni testler: fit hesabı, aile eşleşmesi, sinerji aile kuralı, compToPlan konum/limit kuralları, keepPlan).
- Out: game-hook, panel, overlay, manifest, i18n (yeni metin gerekmez; reasons yapısal).

## Acceptance criteria

- [ ] `node --test tests/*.test.mjs` geçer; yeni testler var.
- [ ] Mevcut `PacAdvisor.analyze` / diğer çıkışlar değişmeden çalışır (mevcut testler geçer).
- [ ] `compToPlan` çıktısı oyun biçimine uyar: `x` 0..7, `y` 1..3, kareler çakışmaz, en fazla 3 item.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma; lider commit'ler.
