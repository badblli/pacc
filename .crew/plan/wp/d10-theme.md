# d10-theme — Bütün eklenti oyunun temasıyla bütünleşik

- Summary: Koç panelinde yaptığımız oyunla bütünleşik görünüm eklentinin geri kalanına da uygulanır: Takım Planlayıcı çekmecesi, Ortak Seçim/portal kartları, tahta üstü rozetler ve ipuçları, popup. Hepsi oyunun yazı tipini, kalın siyah çerçeveli kutularını ve seçili oyun temasının renklerini kullanır.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D10
- Branch: `codex/d10-theme` (base: `main`)
- Depends on: d10-panel (main'de)
- Role: implementer

Use your frontend-design skill.

## Referans: d10-panel (main'de, ürün sahibi beğendi)

`extension/content/panel.css` artık oyunun tema değişkenlerini kullanıyor. Aynı dili diğer yüzeylere taşı:

- Yazı tipi: `Jost`. Oyun belgede yüklüyor, shadow DOM'da kullanılabilir.
- Kap: `background: var(--color-bg-primary, #61738a); border: var(--border-thick, 4px solid #000); border-radius: 12px; color: var(--color-fg-primary, #fff)`.
- Kutu: `background: var(--color-bg-secondary, #54596b); border: var(--border-thin, 2px solid #000); border-radius: 12px`.
- Üçüncül `var(--color-bg-tertiary, #464c5c)`, ikincil metin `var(--color-fg-secondary, #c3cddf)`.
- Vurgu `--color-bg-accent` #1195ec, altın `--color-fg-gold` #ffc107, olumlu `--color-bg-positive` #34a00c / `--color-fg-green` #8ede1d, olumsuz `--color-fg-red` #f74f4f, mavi metin `--color-fg-accent` #69b7eb.
- Oyunun düğmeleri `.bubbly`: dolu renk, `box-shadow: inset -4px -4px` koyu ton, basınca ters iç gölge.

## Tasks

1. **Ortak belirteçler:** yeni `extension/content/theme.css`.
   - `:host` üzerinde `--pacc-*` değişkenleri tanımla; her biri oyunun değişkenine yedek değeriyle bağlanır (`--pacc-bg: var(--color-bg-primary, #61738a)` …).
   - Ayrıca kap/kutu/düğme/çip yardımcı sınıfları: `.pacc-container`, `.pacc-box`, `.pacc-button`, `.pacc-chip`.
   - panel, planner, carousel, overlay content script'leri kendi css'lerinden ÖNCE bunu yükler (aynı fetch deseni). `manifest.json`'da `web_accessible_resources` gerekiyorsa ekle; izinler değişmez.
   - panel.css'teki tekrar eden değerleri bu belirteçlere taşı. Panelin görünümü değişmemeli.
2. **Takım Planlayıcı çekmecesi** (`planner.css`, gerekirse `planner.js` işaretlemesi):
   - Bugünkü koyu lacivert palet yerine oyunun görünümü: PACC düğmesi, yan çekmece, sekmeler, Önerilen/Meta dizilimler/Planım kartları, "Plana yükle" düğmesi (`.bubbly` gibi), uyum yüzdeleri.
   - Çekmece oyunun Team Builder penceresinin içinde duruyor; o pencereyle aynı aileden görünmeli.
3. **Ortak Seçim / portal kartları** (`carousel.css`): kutular, sıra rozetleri, yüzde ve gerekçe metni oyunun stilinde.
4. **Tahta üstü** (`overlay.css`): seçim rozetleri (EN İYİ / İYİ / KAÇIN), dükkan işaretleri, craft ①② işaretleri, yerleşim ↑↓⇅ rozetleri, tooltip ve toast.
   - Oyunun renkleriyle: kalın siyah çerçeve, Jost.
   - Okunabilirlik oyunun canvas'ı üzerinde korunmalı: koyu çerçeve ve yeterli kontrast.
   - Mevcut renk anlamları kalsın: en iyi = yeşil, iyi = mavi, kaçın = kırmızı, craft çiftleri farklı renkler.
5. **Popup** (`popup.css`, `popup.html`):
   - Popup oyunun sayfası değil, tema değişkenleri yok: varsayılan oyun temasının değerlerini doğrudan kullan.
   - Jost'u eklentiye göm: `extension/fonts/Jost-*.woff2` + `OFL.txt` lisansı; yalnız Latin ve Latin-Ext, Türkçe karakterler dahil. Lider dosyaları ekleyecek, sen yalnız `@font-face` ile kullan ve yoksa sans-serif'e düş.
   - Ağdan font çekme yok.
6. **Testler:**
   - Mevcut testler geçmeli.
   - Yeni bir stil testi: dört CSS dosyasında eski lacivert palet (`#1b2030`, `#252b3d`, `#2a3044`, `#313850`, `#3b4360`, `#20263a`, `#0f1320` ve benzerleri; tam liste için dosyaları tara) kalmamalı; renkler ya `var(--pacc-…)`/`var(--color-…, yedek)` ya da açıkça gerekçelendirilmiş istisna olmalı.
   - Harness sayfaları (`planner-harness.html`, `carousel-harness.html`, `overlay-harness.html`, `replay-harness.html`) yeni görünümü çizebilmeli. Oyunun değişkenleri harness'ta yok; yedek değerler görünür. Gerekirse harness'a Jost'u yerel dosyadan yükle.

## Scope

- In:
  - `extension/content/theme.css` (yeni), `panel.css`, `planner.css`, `carousel.css`, `overlay.css`
  - css yükleme satırları için `panel.js`, `planner.js`, `carousel.js`, `overlay.js` (yalnız yükleme ve gerekirse sınıf adları)
  - `extension/popup/popup.css`, `popup.html`, `extension/manifest.json` (yalnız `web_accessible_resources`)
  - `tests/*harness*.html`, yeni `tests/theme.test.mjs`
- Out: davranış ve öneri mantığı (advisor, game-hook, recorder, alert, now.js); i18n metinleri (gerekmedikçe).

## Acceptance criteria

- [ ] `node --check` tüm JS; manifest geçerli, `permissions`/`host_permissions` aynı; `node --test tests/*.test.mjs` geçer; `npm run eval` 56.84%.
- [ ] Stil testi: dört content CSS'inde eski palet yok; renkler oyunun değişkenlerinden.
- [ ] Panelin görünümü değişmez (d10-panel ile aynı).
- [ ] Popup gömülü Jost ile çalışır, ağdan font istemez.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme. Satır içi Türkçe blok yorum JS'te yasak, `//` kullan; CSS'te `/* */` serbest. Eklenti hiçbir şeye tıklamaz. Satır sonlarını koru: dosyalar LF.

## Fontlar (lider ekledi)

`extension/fonts/Jost-latin.woff2`, `Jost-latin-ext.woff2` (değişken ağırlık 400–700) ve `OFL.txt`. Bunları `@font-face` ile `font-weight: 400 700` olarak kullan; aralıklar:

- latin: `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`
- latin-ext: `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF`
