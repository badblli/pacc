# d10-panel — Sade, oyunla bütünleşik koç paneli

- Summary: Sağ alttaki koç paneli sadeleşir ve oyunun kendi görünümünü alır. En üstte en fazla 3 "Şimdi yap" adımı, altında sıradaki rakip ve hedef dizilim tek kart olarak durur; geri kalan her şey "Ayrıntılar" altında kapalı satırlara taşınır. Renkler oyunun tema değişkenlerinden gelir, oyuncu oyunda tema değiştirirse panel de değişir.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D10
- Branch: `codex/d10-panel` (base: `main`)
- Depends on: none (d10-opponent paralel; sözleşme aşağıda)
- Role: implementer

Use your frontend-design skill.

## Onaylı tasarım

Ürün sahibi taslağı onayladı (lider anlattı; iki ekran: hazırlık ve seçim kartı).

**Görünüm, oyunun kendi CSS'inden:**
- Yazı tipi: `Jost`. Oyun belgede yüklüyor, shadow DOM'da da kullanılabilir.
- Ana kap `.my-container` gibi:
  - `background: var(--color-bg-primary, #61738a)`
  - `border: var(--border-thick, 4px solid #000)`
  - `border-radius: 12px`
  - `color: var(--color-fg-primary, #fff)`
- İç kutular `.my-box` gibi:
  - `background: var(--color-bg-secondary, #54596b)`
  - `border: var(--border-thin, 2px solid #000)`
  - `border-radius: 12px`
- Üçüncül ton `var(--color-bg-tertiary, #464c5c)`; ikincil metin `var(--color-fg-secondary, #c3cddf)`.
- Vurgular: `--color-bg-accent` #1195ec, `--color-fg-gold` #ffc107, `--color-bg-positive` #34a00c, `--color-fg-green` #8ede1d, `--color-fg-red` #f74f4f, `--color-fg-accent` #69b7eb.
- Özel değişkenler shadow sınırından miras geçer; host'taki `all: initial` onları sıfırlamaz. Doğrula ve her `var()`'a yukarıdaki yedek değeri ver.
- Kendi koyu lacivert paletimizi panelden kaldır.

**Oyunum sekmesi, yukarıdan aşağı:**
1. Başlık: logo + "PACC" + küçült düğmesi (var olan davranış).
2. **Durum çipleri** tek satırda: Aşama, Seviye, Altın, Can. Varsa yeşil ekonomi çipi: "50 altına 16 kaldı: faiz +5" (mevcut eco önerisinden).
3. **"Şimdi yap"** kartı: altın iç çerçeve, en fazla 3 numaralı adım. 1 numara altın daire. Her adım kalın bir satır + bir satır gri gerekçe. Öncelik sırası:
   1. Açık seçim kartı (Pokémon ya da item)
   2. Hemen yap (craft)
   3. Dükkanda işine yarayan
   4. Yerleşim
   5. Ekonomi (çipte yoksa)

   Kural: seçim kartı açıksa kartın başlığı seçimin adı olur ("Eşsiz Pokémon seç"). En iyi seçenek yeşil kutuda "EN İYİ · %32" rozetiyle, ikinci "İYİ · %31". Kalanlar tek satırda "Charcadet %21 · Aerodactyl %10 …".
4. **"Sıradaki rakip"** kartı (`PacAdvisor.nextOpponents`, aşağıda):
   - İlk aday: büyük mavi yüzde, ad, "Can 46 · 8 birim", en çok 3 sinerji çipi (oyunun tip renkleriyle), "Güçlü birimleri: Dragonite ★★, Flygon ★★".
   - Diğer adaylar tek satır.
   - `kind: "pve"` → "Sıradaki tur: vahşi Pokémon".
   - `unknown` ya da fonksiyon yoksa kart gizli.
   - Seçim kartı açıkken bu kart tek satıra küçülür ("Kenji %67, Mira %33 ›"); tıklanınca açılır.
5. **"Hedef dizilim"** kartı: "Hedef dizilim: Psişik · Peri" + "4 / 7" + yeşil ilerleme çubuğu + "Eksik: …" (mevcut comps/plan verisinden; plan varsa plan).
6. **"Ayrıntılar"** listesi: kapalı satırlar (`<details>`/düğme), sağda kısa sayaç ("6 aktif ›").
   - Satırlar: Sinerjiler, Dükkan, Item önerileri, Diğer dizilimler, Havuz ve bölgesel, Rakip tahtası (eski "Rakip" bölümü).
   - İçerik bugünkü bölümlerin aynısı, varsayılan KAPALI.
   - Açık/kapalı durumu bugünkü `state.open` gibi hatırlanır.
7. Sekmeler: "Oyunum" ve "Meta". Mevcut Pokémon/Dizilimler/Itemler sekmeleri Meta altında kalabilir; içeriklerini silme, sadece gruplayabilirsin.

**Panel boyutu:** genişlik yaklaşık 360 px (bugünkü gibi). Dokunma hedefleri en az 32 px. Metin kontrastı en az 4.5:1. #c3cddf, #54596b üzerinde ~5:1, uygun.

## d10-opponent sözleşmesi

```
PacAdvisor.nextOpponents?.(ctx, snap) →
{ kind: "pvp" | "pve" | "unknown",
  candidates: [{ id, name, pct, life, units, synergies: [[syn, n], …], top: [{ name, stars }, …] }] }
```

Fonksiyon henüz main'de yok: `typeof` kontrolüyle çağır, yoksa kartı gizle. Testlerde sahte bir `nextOpponents` ver.

## Tasks

1. "Şimdi yap" öncelik listesi için saf fonksiyon: yeni `extension/content/now.js`, `window.PacNow.nowActions({ analysis, board, snap })` → `[{ kind, title, detail }]`, en çok 3.
   - manifest'te panel.js'ten önce yükle.
   - `kind`: choice / craft / shop / placement / eco.
2. `panel.js` / `panel.css`: yukarıdaki düzen ve tema değişkenleri.
   - Bugünkü bölümlerin içeriği Ayrıntılar'a taşınır.
   - Çevrilmeyen metin kalmaz: yeni i18n anahtarları EN+TR (`panel.now.*`, `panel.opp.*`, `panel.target.*`, `panel.details.*`).
3. Testler:
   - `tests/panel.test.mjs` (yeni): `nowActions` önceliği (seçim kartı varsa ilk o; en çok 3), boş durumda boş liste.
   - Panel render: mevcut harness/test desenleriyle. Üç durum: seçim kartı açık, hazırlık, rakip kartı gizli/görünür/pve.
   - i18n eşitliği.
4. `tests/replay-harness.html` gerekiyorsa panelin yeni görünümünü çizebilsin. Oyunun CSS değişkenleri harness'ta yok; yedek değerler görünür.

## Scope

- In: `extension/content/panel.js`, `extension/content/panel.css`, `extension/content/now.js` (yeni), `extension/manifest.json` (yalnız content script listesi; izinler değişmez), `extension/i18n/en.json`, `tr.json`, `tests/panel.test.mjs`, `tests/replay-harness.html`.
- Out: advisor.js, game-hook.js, recorder.js (d10-opponent). Overlay/planner/carousel görünümü bu WP'de değişmez.

## Acceptance criteria

- [ ] `node --check` tüm JS; manifest geçerli, izinler aynı; `node --test tests/*.test.mjs` geçer (i18n eşitliği dahil); `npm run eval` 56.84%.
- [ ] Oyunum sekmesinde üstte en fazla 3 adım; Ayrıntılar varsayılan kapalı; bugünkü bilgilerin hiçbiri kaybolmaz (Ayrıntılar'da).
- [ ] Renkler `var(--color-…, yedek)` ile; panelde eski lacivert palet (#1b2030, #252b3d, #3b4360 vb.) kalmaz.
- [ ] `nextOpponents` yokken panel hatasız; varken kart doğru çizilir (test).

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme. Satır içi Türkçe blok yorum yasak, `//` kullan. Eklenti hiçbir şeye tıklamaz.
