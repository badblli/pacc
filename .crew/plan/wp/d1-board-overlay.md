# d1-board-overlay — Oyun ekranının üstünde highlight'lı öneri katmanı

- Summary: Seçim pencerelerindeki (starter, ek/eşsiz/efsanevi Pokémon, item) seçeneklerin ve dükkan slotlarının üstüne yeşil "Önerilen" / kırmızı "Kaçın" çerçeve + rozet + gerekçe koyan, tıklamaları engellemeyen overlay.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D1
- Branch: `codex/d1-board-overlay` (base: `main`)
- Depends on: none (d1-advice-engine ile paralel; aşağıdaki API sözleşmesine göre yaz)
- Role: implementer

## Goal

Kullanıcı: "eklenti direkt tahta üzerinde yani oyunun kendisinde çalışsa, highlight'larla seç / yapma
önerileri görünse." Panel açmadan, oyunun kendi seçim kartlarının üstünde öneri görünmeli.
Use your frontend-design skill: oyunun koyu, piksel-art arayüzüne uyan, okunaklı ama oyunu
kapatmayan bir görünüm.

## Oyunun DOM'u (kaynak: pokemonAutoChess master, app/public/src/pages/component/game/)

- Seçim penceresi (`game-choice.tsx`): `div.game-choice > div.my-container` (gizlenince
  `visibility: hidden`), içinde `h2` başlık ve
  - Pokémon seçimi: `div.game-choice-pokemons-list > div.my-box` — i. kutu = `choice.pokemons[i]`
  - Item seçimi: `div.game-choice-items-list > div.my-box` — i. kutu = `choice.items[i]`
  Ekranda yalnız `choices[0]` gösterilir. `.game-choice` `pointer-events: none`, kutular `pointer-events: initial`.
- Dükkan (`game-store.tsx`): `ul.game-pokemons-store > div.game-pokemon-portrait` — i. öğe = `shop[i]`
  (boş slot `.game-pokemon-portrait.empty`). Portreler `background-image` (çoğu zaman base64) kullanır,
  `img src` ile tanınamaz: eşleştirme SIRA ile yapılır.
- Oyun Phaser canvas + React DOM. Seçim/dükkan DOM'da; canvas üstüne çizim bu WP'de yok.

## Öneri API'si (d1-advice-engine yazıyor — bu sözleşmeye göre kodla)

`window.PacAdvisor.boardAdvice(ctx, snap)` (content script dünyasında, `content/advisor.js`):
```js
{
  choice: null | { id, type, kind: "pokemon" | "item",
    options: [{ index, verdict: "best" | "good" | "neutral" | "avoid", label, reasons: string[], score }] },
  shop: [{ index, verdict: "good" | "neutral", label, reasons: string[] }]
}
```
`ctx = { data, tierPokemons, tierItems, clusters, minGames, thresholds, names: { pkm, syn, item } }`
(`names.*` Türkçe çeviri dosyasından görünen ad döndürür; bkz. panel.js `pkmName/synName/itemName`).
`snap` = game-hook.js'in `window.postMessage({ type: "pac-yardimci:game", snapshot })` ile yolladığı özet
(yeni alan `snap.choices = [{ id, type, pokemons, items, costs }]`).
`boardAdvice` henüz yoksa (`typeof !== "function"`) overlay sessizce hiçbir şey çizmesin.

## Scope

- In: yeni `extension/content/overlay.js`, yeni `extension/content/overlay.css`,
  `extension/manifest.json` (content_scripts: advisor.js'ten SONRA overlay.js; overlay.css'i
  web_accessible_resources'a ekle), `extension/popup/popup.html` + `popup.js` (yeni "Tahta üstü
  öneriler" anahtarı, ayar adı `overlay`, varsayılan açık), `extension/background.js`
  (`DEFAULT_SETTINGS.overlay = true`), yeni `tests/overlay-harness.html` (bkz. görev 6).
- Out: `advisor.js`, `game-hook.js`, `panel.js`, `panel.css` (panelin koduna dokunma). `translations/`, `scripts/build-translation.mjs`.

## Tasks

1. `overlay.js`: panel.js gibi IIFE, tekrar yüklenme koruması (`window.__pacOverlay`). Kendi
   shadow-root'lu host'u: `position: fixed; inset: 0; pointer-events: none; z-index: 2147483000`
   (panel 2147483646/7'nin ALTINDA kalmalı → panelle çakışmaz). Kendi verisini yükler:
   `locales/tr/translation.json`, `data/static.json`, `chrome.storage.local` (`settings`, `meta`),
   meta yoksa `chrome.runtime.sendMessage({type:"get-meta"})`. Ayar `settings.overlay === false`
   ise hiçbir şey çizmez; `storage.onChanged` ile canlı aç/kapa.
2. `message` dinleyicisi (`pac-yardimci:game`) ile son `snapshot`'ı tutar; başlangıçta
   `window.postMessage({type:"pac-yardimci:hello"}, location.origin)` yollar (panel de yolluyor; ikisi birden sorun değil).
3. Hedef bulma: yukarıdaki seçicilerle kutuları bul; `boardAdvice` sonucundaki `index` ile eşle.
   Kutu sayısı seçenek sayısıyla uyuşmazsa o ekranı çizme (yanlış eşleşmeyi önle). Görünmeyen
   (`visibility:hidden`, 0 boyut, ekrandışı) kutulara çizme.
4. Çizim: her hedef için `getBoundingClientRect()` ile konumlanan çerçeve:
   - best: kalın yeşil çerçeve + hafif nabız/parıltı + sol üstte "✓ Önerilen" rozeti;
   - good: ince yeşil çerçeve + "İyi seçenek" küçük rozet;
   - avoid: kırmızı çerçeve + "✗ Kaçın" rozeti + hafif kırmızı karartma;
   - neutral: hiçbir şey.
   Seçim kartlarında kartın hemen altına (ya da kart içinde altta) en önemli gerekçe tek satır,
   küçük, okunaklı. Dükkanda sadece köşe rozeti (★ / ✓) + çerçeve, metin yok.
   Konumlar `requestAnimationFrame` döngüsünde (en fazla ~10 kez/sn ölçüm) ve resize/scroll'da
   güncellenir; hedef yoksa döngü boşta ucuz kalır (MutationObserver ya da 250 ms kontrol).
5. Tooltip: overlay `pointer-events: none` olduğundan, `document`'e pasif `pointermove`
   dinleyicisi ekle; imleç bir hedefin dikdörtgenindeyse tüm gerekçeleri (başlık: Pokémon/item
   görünen adı + karar) içeren küçük bir tooltip göster. Oyunun kendi tooltip'iyle çakışmaması
   için tooltip'i kartın ALTINA (yer yoksa yanına) koy. Hiçbir olayı `preventDefault` /
   `stopPropagation` etme; oyunda hiçbir şeye tıklama.
6. `tests/overlay-harness.html`: tarayıcıda dosyadan açılabilen test sayfası. `chrome.*` için
   küçük bir stub (storage/runtime.getURL → göreli yol `../extension/...`), oyunun DOM'unu taklit
   eden statik işaretleme (starter penceresi 4 kartlı + dükkan 6 slotlu, oyuna benzer koyu stil),
   `../extension/content/advisor.js` ve `overlay.js`'i yükler; `PacAdvisor.boardAdvice` yoksa
   harness içinde sahte bir `boardAdvice` tanımlar (best/good/avoid/neutral örnekleri) ve sahte
   snapshot'ı `postMessage` ile yollar. Butonlarla "starter / item seçimi / sadece dükkan / gizli
   pencere" senaryoları arasında geçiş. Amaç: lider overlay'i gerçek oyuna girmeden görsel olarak
   doğrulayabilsin.
7. popup: "Tahta üstü öneriler" anahtarı (açıklama: "Seçim pencerelerinde ve dükkanda önerilen
   seçeneği yeşil, kaçınılacağı kırmızı çerçeveyle işaretler.").

## Acceptance criteria

- [ ] Harness'te starter senaryosunda best kart yeşil çerçeve + "✓ Önerilen" rozeti + gerekçe satırı, avoid kart kırmızı; neutral'da çizim yok.
- [ ] Overlay hiçbir tıklamayı/hover'ı engellemez (pointer-events none; kartlara tıklama oyuna gider).
- [ ] Panel (z-index daha yüksek) her zaman overlay'in üstünde; panel açıkken overlay görünür kalır ama panelin altında.
- [ ] Pencere gizlenince / seçim yapılınca çerçeveler en geç ~300 ms içinde kaybolur.
- [ ] Ayar kapalıyken hiçbir şey çizilmez; popup anahtarı çalışır.
- [ ] AGENTS.md komutları geçer (node --check, manifest JSON).

## Notes

- Kod stili: panel.js ile aynı (2 boşluk, noktalı virgülsüz, Türkçe yorumlar).
- Gerçek oyunda test lider tarafından yapılacak; harness sadece görsel/konum doğrulaması için.
- Ağ çağrısı ekleme (eklentinin kendi dosyaları ve chrome.runtime mesajları hariç).
