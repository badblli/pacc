# d9-placement — Yerleşim önerisi: yakın dövüşçüler öne, menzilliler arkaya

- Summary: Koç, tahtadaki Pokémonların yanlış sırada durduğunu görünce (ör. menzili 3 olan Gardevoir ön sırada, yakın dövüşçü Garchomp arka sırada) bunu panelde ve tahtadaki birimin üzerinde küçük bir okla söyler. Öneriler oyunun kendi savaş istatistiklerinden gelir; eklenti hiçbir birimi kendisi taşımaz.
- Engine: codex
- Model: standard
- Phase: D9
- Branch: `codex/d9-placement` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Hazırlık fazında (phase 0, PICK) tahtadaki açık yerleşim hatalarını en fazla 3 kısa ipucuyla göstermek: panelde bir "Yerleşim" kartı ve overlay'de ilgili birimin üzerinde ↑ (öne al) / ↓ (arkaya al) / ⇅ (yer değiştir) rozeti.

## Veri

- `extension/data/static.json` → yeni `stats` anahtarı (lider ekledi): `name -> [menzil, can, saldırı, savunma, özel savunma]`, oyunun `pokemons-data.csv` dosyasından. Menzil dağılımı: 1 → 762, 2 → 242, 3 → 135, 4+ → 12. Menzil 9 olanlar özel birimlerdir (yumurta vb.); yok say.
- Tahta: `snap.board[i] = { name, x, y, stars, items, types }`. y=0 yedek, y=1..3 savaş alanı, **y=3 ön sıra** (rakibe en yakın), y=1 arka sıra. Tahta 8 sütun (x 0..7). Kaynak: `docs/` ve `pac-game-dom-gotchas` notu; şüphen varsa game-hook.js'teki `unitsOf` ve kaydı kontrol et.
- Meta raporunda konum verisi YOK: kurallar yalnız istatistiklerden çıkar. Kurallar muhafazakâr olmalı: emin olmadığın durumda öneri verme.

## Tasks

1. **advisor.js:** `placementAdvice(ctx, snap)` → `[{ index, name, x, y, move: "front" | "back" | "swap", with?: index, reason }]`. `PacAdvisor` dışa açık olsun ve `analyze`/`boardAdvice` çıktısına `placement` olarak eklensin.
   - Rol: menzil 1 = yakın dövüş, menzil ≥ 3 = arka sıra birimi, menzil 2 = esnek (öneri yok). Dayanıklılık: `can × (1 + (savunma + özel savunma) / 20)`; ağırlıkları `WEIGHTS` içine koy (`PLACE_*`), yorumla açıkla.
   - Kural A (arkaya al): menzil ≥ 3 bir birim y=3'te ve arka sıralarda (y=1 ya da y=2) boş hücre ya da yakın dövüşçü varsa.
   - Kural B (öne al): menzil 1 bir birim y=1'de ve y=3'te boş hücre ya da menzil ≥ 3 birim varsa.
   - A ve B aynı anda geçerliyse tek "swap" ipucu üret (ikisini birbirine bağla).
   - Hiç yakın dövüşçü yoksa ön sırada en dayanıklı birim kalabilir; Kural A bu birim için tetiklenmesin.
   - Sıra: önce swap, sonra dayanıklılık/menzil farkı en büyük olanlar; en fazla 3. Yalnız y > 0 birimler. `stats` kaydı yoksa birim atlanır.
   - Gerekçe metinleri i18n anahtarlarıyla (ör. "Gardevoir menzilli (3): arka sıraya al", "Garchomp yakın dövüşçü: ön sıraya al", "Gardevoir ↔ Garchomp yer değiştir"), EN + TR. Adlar `displayName` ile.
   - Snapshot başına önbellek (`perSnap` deseni advisor.js'te var).
2. **panel.js:** Oyunum sekmesinde ipucu varsa küçük bir "Yerleşim" kartı (mevcut kart stilini kullan); ipucu yoksa kart görünmez.
3. **overlay.js:** Hazırlık fazında `screen.units` dikdörtgenleriyle ilgili birimin üzerine küçük ↑/↓/⇅ rozeti ve tooltip (craft işaretlerinin birim bulma kodunu yeniden kullan; `index` + ad + x/y ile eşleştir). Savaş/kasaba fazında ve overlay ayarı kapalıyken gizli. Mevcut overlay ayarı dışında yeni ayar ekleme.
4. **Testler:** `tests/advice.test.mjs` içinde: Kural A, Kural B, swap, yakın dövüşçüsüz takım (öneri yok), menzil 2 (öneri yok), stats'sız birim, en fazla 3 ipucu. `tests/replay.test.mjs`: her oyun durumunda `placement` indeksleri geçerli ve y > 0 birimi gösteriyor, çağrı < 50 ms. Gerçek kayıt `tests/fixtures/games/real-20261020-1952.json` var: son tahtada (Pikachu ön, Uxie arka vb.) saçma bir öneri çıkmadığını bir testle göster.

## Scope

- In: `extension/content/advisor.js`, `extension/content/panel.js`, `extension/content/panel.css` (gerekirse), `extension/content/overlay.js`, `extension/content/overlay.css` (gerekirse), `extension/i18n/en.json`, `extension/i18n/tr.json`, `tests/advice.test.mjs`, `tests/replay.test.mjs`.
- Out: `extension/data/static.json` ve `scripts/` (lider yaptı), game-hook, planner, carousel, eval betiği ve ağırlık ayarı. Eklenti hiçbir birimi taşımaz ve hiçbir şeye tıklamaz.

## Acceptance criteria

- [ ] `node --check` tüm JS; `node --test tests/*.test.mjs` geçer (i18n EN/TR anahtar eşitliği dahil); `npm run eval` amaç puanı değişmez (56.84%).
- [ ] Menzil ≥ 3 birim ön sırada + yakın dövüşçü arka sırada → tek swap ipucu; menzil 2 birimler ve yakın dövüşçüsüz takımda en dayanıklı ön birim için ipucu yok (test).
- [ ] Gerçek kayıtta her durumda ipucu indeksleri geçerli; çağrı < 50 ms.
- [ ] Overlay rozeti yalnız hazırlık fazında; savaşta görünmez.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme. Satır içi Türkçe blok yorum (`/* ... */`) kod satırında olmasın: i18n testi bunu yasaklar, ayrı `//` satırı kullan.
