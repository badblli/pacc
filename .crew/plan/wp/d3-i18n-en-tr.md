# d3-i18n-en-tr — İngilizce + Türkçe arayüz, tarayıcı diline göre

- Summary: Eklentinin tüm arayüzü (panel, tahta üstü öneriler, popup, öneri gerekçeleri) İngilizce ve Türkçe olur; dil tarayıcı dilinden seçilir, popup'tan değiştirilebilir; README iki dilli.
- Engine: claude
- Model: deep
- Phase: D3
- Branch: `claude/d3-i18n-en-tr` (base: `main`, D2 birleştikten sonra)
- Depends on: d2-choice-percent, d2-canvas-craft-highlight, d2-panel-readability, d2-tr-live-keys (hepsi main'de olmalı)
- Role: implementer

## Goal

Kullanıcı: "Bu eklenti global olarak kullanılabilir olmalı, İngilizce arayüzü de olmalı, tarayıcı dilinden almalı veya dil seçilebilmeli;
şu an Türkçe/İngilizce, GitHub'a öyle yükle."

## Scope

- In: yeni `extension/_locales/en/messages.json` + `extension/_locales/tr/messages.json` (manifest adı/açıklaması, `default_locale: "en"`),
  yeni `extension/i18n/en.json` + `extension/i18n/tr.json` (arayüz metinleri), yeni `extension/content/i18n.js` (paylaşılan yardımcı),
  `extension/manifest.json`, `extension/background.js`, `extension/content/advisor.js`, `extension/content/panel.js`, `extension/content/overlay.js`,
  `extension/popup/*`, `tests/*`, `README.md` (İngilizce) + yeni `README.tr.md`.
- Out: `translations/`, `scripts/build-translation.mjs`, `extension/locales/tr/translation.json` (oyunun çevirisi; ayrı konu).

## Tasks

1. Dil seçimi: ayar `settings.uiLang` = "auto" | "en" | "tr" (varsayılan "auto"). "auto" → `chrome.i18n.getUILanguage()` / `navigator.language` "tr" ile başlıyorsa tr, değilse en.
   Popup'ta dil seçici (Otomatik / English / Türkçe). Değişince panel ve overlay canlı yeniden çizilir.
2. `i18n.js`: `PacI18n.t(key, vars)` (`{{var}}` yerleştirme, `_one/_other` çoğul), `PacI18n.lang`, `PacI18n.setLang()`. Content script'lerde advisor/overlay/panel'den önce yüklenir (manifest sırası).
   Katalog dosyaları `fetch(chrome.runtime.getURL(...))` ile; web_accessible_resources'a ekle.
3. Tüm sabit metinleri katalog anahtarlarına taşı: panel (sekmeler, başlıklar, notlar, ekonomi ipuçları, boş durumlar), overlay (rozetler, tooltip),
   popup, advisor gerekçeleri (advisor şu an Türkçe metin üretiyor → `ctx.t` ile anahtar + değişken; ctx.t yoksa İngilizce varsayılan).
   Pokémon/item/sinerji ADLARI: dil en ise oyunun kendi İngilizce adları (static/meta anahtarından okunur ad ya da oyunun en çevirisi), tr ise mevcut TR dosyası.
4. Oyun çevirisi (declarativeNetRequest yönlendirmesi): `settings.translation` varsayılanı uiLang tr ise true, değilse false (onInstalled'da). Popup'ta bu seçenek "Oyunu Türkçeye çevir (Turkish game translation)" olarak kalır.
5. Manifest: `"default_locale": "en"`, `name`/`short_name`/`description`/`action.default_title`/`commands` açıklaması `__MSG_…__`.
6. README.md İngilizce (kurulum, özellikler, ekran görüntüsü yeri, yazar badblli, lisans GPL-3.0, oyunun kuralları notu), README.tr.md Türkçe; ikisi birbirine bağlantı versin.
7. Testler: advisor gerekçeleri en ve tr'de anahtar eksiksiz (eksik anahtar testte hata); iki katalogda aynı anahtar seti (test).

## Acceptance criteria

- [ ] Tarayıcı dili İngilizce iken her şey İngilizce, Türkçe iken Türkçe; popup'tan elle değiştirilebilir ve canlı uygulanır.
- [ ] Kataloglarda anahtar seti eşit; kodda kullanıcıya görünen sabit Türkçe/İngilizce metin kalmadı (grep ile kontrol, istisnalar raporda).
- [ ] Oyun çevirisi varsayılanı dile göre.
- [ ] `node tests/advice.test.mjs` + yeni i18n testi + AGENTS.md komutları geçer.
- [ ] README.md (EN) ve README.tr.md (TR) güncel ve birbirine bağlı.
