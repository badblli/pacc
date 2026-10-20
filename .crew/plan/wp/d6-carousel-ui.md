# d6-carousel-ui — Ortak Seçim ve portal sahnesinde öneri kartı

- Summary: Ortak Seçim (carousel) sırasında ortadaki itemlerin önerilen sırası, bölge portalı sahnesinde portalların önerilen sırası ekranda küçük bir kartta gösterilir.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D6
- Branch: `codex/d6-carousel-ui` (base: `main`)
- Depends on: d6-carousel-advice (sözleşmeler aşağıda; paralel çalışır, veri yoksa kart görünmez)
- Role: implementer

## Goal

Use your frontend-design skill. Mevcut PACC görsel dili (koyu lacivert, 2px çerçeve, altın vurgu `#f6c445`, yeşil `#5fd68a`; `extension/content/planner.css` ve overlay ile tutarlı). Bu sahneler oyunun Phaser tuvalinde; tuval koordinatına çizme — sabit konumlu bir kart yeterli.

## Sözleşmeler (d6-carousel-advice)

- `pac-yardimci:game` snapshot'ında `carousel: null | {kind:"items", items:[{id,name,taken}]} | {kind:"portals", portals:[{id,map,synergies,taken}]}`.
- `PacAdvisor.rankCarousel(ctx, snap, plan)` → `[{item, taken, score, reasons:[{kind:"craft"|"component"|"want"|"comp", pkm?, item?}]}]`
- `PacAdvisor.rankPortals(ctx, snap, plan)` → `[{portalId, map, taken, score, synergies, regional:[{pkm,fit}], meta:{rank,count}|null, reasons:[{kind:"syn"|"regional"|"meta"|"plan", syn?, pkm?}]}]`
- `ctx`: panel/planner'daki gibi kur (static.json, meta storage, i18n `t`), `ctx.regionsMeta = meta.regions`. `plan` = son `pac-yardimci:planner` mesajındaki board (yoksa []).

## Tasks

1. Yeni `extension/content/carousel.js` + `carousel.css` (manifest'te advisor/i18n/planner'dan sonra; css web_accessible_resources'a). Kendi shadow host'u; oyunun DOM'una düğüm ekleme.
2. `snap.carousel?.kind === "items"`: üst ortada (oyunun aşama/zamanlayıcı şeridini kapatmadan, ~72px aşağıda) "Ortak Seçim — önerilen sıra" kartı: ilk 5 item (ikon `/assets/item/<ITEM>.png`, ad oyunun çevirisinden — panel.js'deki item adı yardımcısıyla aynı yöntem), puan çubuğu, tek satır gerekçe (reasons → i18n metni: "X ile hemen birleşir", "Y için parça", "planındaki Z istiyor", "dizilim itemi"); alınmışlar soluk + üstü çizili, en sona.
3. `kind === "portals"`: aynı yerde "Bölge seçimi — önerilen sıra" kartı: her portal için bölge adı (oyunun `map` çevirisi), sinerji çipleri (`/assets/types/<SYN>.svg`), en fazla 3 bölgesel Pokémon portresi, meta ortalama sırası; alınmışlar soluk.
4. Kart küçültülebilir (başlık düğmesi, ≥44px hedef), durum sayfa yenilenene kadar hatırlanır; carousel bitince (null) kaybolur. Popup ayarı `settings.overlay` kapalıysa gösterme.
5. i18n anahtarları EN + TR (`extension/i18n/en.json`, `tr.json`, aynı anahtar seti).
6. `tests/carousel-harness.html` (planner-harness gibi): sahte snapshot ve sahte PacAdvisor ile iki kartı gösterir; `tests/carousel-ui.test.mjs`: kart görünürlük kuralları (null → yok, overlay kapalı → yok), sıralama ve alınmış öğe davranışı.

## Scope

- In: `extension/content/carousel.js`, `extension/content/carousel.css`, `extension/manifest.json`, `extension/i18n/en.json`, `extension/i18n/tr.json`, `tests/carousel-harness.html`, `tests/carousel-ui.test.mjs`.
- Out: advisor, game-hook, background, static data (d6-carousel-advice).

## Acceptance criteria

- [ ] Tüm `node --check`, manifest JSON, `node --test tests/*.test.mjs` (i18n anahtar eşitliği dahil) geçer.
- [ ] Harness'ta item ve portal kartları tasarıma uygun görünür, küçültülür, alınmışlar sona ve soluk.
- [ ] Oyunun DOM'una düğüm eklenmez.

## Notes

Kod yorumları Türkçe, arayüz metinleri i18n'den. Git komutu çalıştırma; lider commit'ler.
