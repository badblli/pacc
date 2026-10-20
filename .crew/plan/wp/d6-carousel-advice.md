# d6-carousel-advice — Ortak Seçim ve bölge portalı için veri + öneri motoru

- Summary: Eklenti Ortak Seçim (carousel) sırasında ortadaki itemleri, bölge portalı sahnesinde portalları okur; öneri motoru itemleri takımına/planına göre, portalları bölge sinerjisi, bölgesel Pokémonlar ve bölge meta istatistiğine göre sıralar.
- Engine: codex
- Model: deep
- Phase: D6
- Branch: `codex/d6-carousel-advice` (base: `main`)
- Depends on: none (d6-carousel-ui paralel; aşağıdaki sözleşmeler bağlayıcı)
- Role: implementer

## Oyunun gerçek yapısı (upstream keldaanCommunity/pokemonAutoChess)

- `GameState.floatingItems: MapSchema<FloatingItem{id, name: Item, x, y, avatarId}>` — Ortak Seçim'de ortada dönen itemler; `avatarId !== ""` alınmış demek. Ortak Seçim aşamaları `ItemCarouselStages = [4, 12, 17, 22, 27, 34]`.
- `GameState.portals: MapSchema<Portal{id, x, y, avatarId, map: DungeonPMDO}>` ve `GameState.symbols: MapSchema<SynergySymbol{id, x, y, synergy, portalId}>` — bölge portalı sahnesi (`PortalCarouselStages = [0, 10, 20]`); semboller `portalId` ile portala bağlı.
- Bölgeler: `app/config/maps/regions.ts` → `RegionDetails[map].synergies` (Synergy[]). Bölgesel bir Pokémon, tipleri bölge sinerjileriyle kesişiyorsa o bölgede çıkar (`Pokemon.isInRegion`, yaklaşık kural yeterli).
- Bölge meta'sı: `GET /meta/regions` → `[{name: "HowlingForest2", count, rank, elo, pokemons: [Pkm×3]}]`.

## Tasks

1. `scripts/build-static-data.mjs`: `regions: { [map]: Synergy[] }` alanını `app/config/maps/regions.ts`'den çıkar (`town` hariç), static.json'a ekle; doğrulama eşiği (≥ 50 bölge). `npm run build:data` ile `extension/data/static.json`'u yeniden üret.
2. `extension/background.js`: büyük dosyalar indirilirken `/meta/regions` da indirilsin (aynı "rapor değiştiyse" kuralı), `meta.regions = { [name]: [rank, count, pokemons] }` olarak sakla; `META_FORMAT`'ı 3 yap.
3. `extension/page/game-hook.js` snapshot'ına alan ekle (sözleşme):
   `carousel: null | { kind: "items", items: [{id, name, taken}] } | { kind: "portals", portals: [{id, map, synergies: [Synergy], taken}] }`
   — floatingItems doluysa "items", portals doluysa "portals" (semboller portalId ile gruplanır; sembol yoksa `RegionDetails`'tan değil, boş dizi). Sadece canlı GameState'ten; bulunamazsa null.
4. `extension/content/advisor.js` (sözleşme, saf fonksiyonlar, hata yerine boş sonuç):
   - `PacAdvisor.rankCarousel(ctx, snap, plan = [])` → `[{item, taken, score: 0..100, reasons: [{kind: "craft"|"component"|"want"|"comp", pkm?, item?}]}]` — alınmamışlar önce, puana göre. Mevcut `rankPropositions` mantığını yeniden kullan: tahtadaki birimlerin önerilen itemleri, eldeki parçayla hemen yapılabilen tarif ("craft"), istenen itemin parçası ("component"), planlayıcı planındaki birimlerin item'ları ("want"), en iyi dizilimin item'ları ("comp").
   - `PacAdvisor.rankPortals(ctx, snap, plan = [])` → `[{portalId, map, taken, score: 0..100, synergies, regional: [{pkm, fit}] (en fazla 3), meta: {rank, count} | null, reasons: [{kind: "syn"|"regional"|"meta"|"plan", syn?, pkm?}]}]` — puan: bölge sinerjilerinin takımının/planının aktif ve yakın sinerjileriyle örtüşmesi, bölgede çıkacak bölgesel Pokémonların `fitScore`'u, `ctx.regionsMeta[map]` ortalama sırası (azsa daha iyi; `count` < `minGames` ise yok say).
   - `ctx`'e `regionsMeta` (meta.regions) eklenebilir; yoksa meta katkısı sıfır.
5. Testler: `tests/carousel.test.mjs` — rankCarousel sıralaması (alınmış en sona, craft > component), rankPortals sinerji/regional/meta katkıları ve eksik veride boş sonuç; static.json'da `regions` alanı var.

## Scope

- In: `scripts/build-static-data.mjs`, `extension/data/static.json`, `extension/background.js`, `extension/page/game-hook.js`, `extension/content/advisor.js`, `tests/carousel.test.mjs`.
- Out: UI dosyaları (overlay/panel/planner/yeni carousel.js), manifest, i18n.

## Acceptance criteria

- [ ] `node --test tests/*.test.mjs` ve tüm `node --check` geçer.
- [ ] static.json `regions` içerir; background `meta.regions` ve `format: 3` yazar; manuel yenileme kuralı (rapor değişmediyse büyük dosya yok) korunur.
- [ ] Snapshot'ta `carousel` alanı sözleşmedeki şekilde; mevcut alanlar değişmez.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma; lider commit'ler. Sunucuya ek istek sadece /meta/regions (rapor değişince bir kez).

Ağ erişimin yoksa upstream kaynağı için yerel klonu kullan: `node scripts/build-static-data.mjs --repo "<yerel geçici klasör>"` (salt okunur; `app/config/maps/regions.ts`, `app/types/enum/*.ts`, `app/models/precomputed/pokemons-data.csv` orada).
