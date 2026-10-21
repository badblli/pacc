# d9-alert — Oyun arka plandayken "sıra sende" sesli uyarısı

- Summary: Oyuncu oyun sekmesini arka plana atınca savaşın bittiğini, item/Pokémon seçiminin ya da Ortak Seçim/portalın geldiğini kaçırıyor. Sekme arka plandayken bu anlarda kısa bir uyarı sesi çalınır ve sekme başlığı "🔔 Sıra sende" olur; oyuncu sekmeye dönünce başlık eski haline gelir. Popup'tan kapatılabilir.
- Engine: codex
- Model: standard
- Phase: D9
- Branch: `codex/d9-alert` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Sekme gizliyken (`document.hidden`) ya da pencere odakta değilken, oyuncunun bir şey yapması gereken anlar gelince bir kez sesli uyarı ve başlık uyarısı.

## Tetikleyiciler

Snapshot alanları `extension/page/game-hook.js` yayınındaki `pac-yardimci:game` mesajından gelir (`phase`, `choices[0].id`, `carousel.kind`, `stage`):

- Savaş bitti, hazırlık başladı: `phase` PICK (0) olmayan bir değerden 0'a geçti.
- Yeni seçim kartı: `choices[0].id` yeni (önceki uyarının id'sinden farklı).
- Ortak Seçim ya da portal başladı: `carousel` null iken dolu geldi.
- Aynı an için bir kez çal; ardışık tetikler 3 sn içinde birleşir (savaş biter biter seçim gelirse tek ses).
- Sekme görünür ve odaktaysa hiçbir şey yapma.

## Tasks

1. **Yeni `extension/content/alert.js`** (manifest'te diğer content script'lerle, ISOLATED dünya):
   - `pac-yardimci:game` mesajlarını dinle, yukarıdaki geçişleri tespit et.
   - **Ses:** WebAudio ile kısa iki notalı çan, dosya yok. Yaklaşık 0.4 sn, makul ses düzeyi (gain ≤ 0.2).
     - `AudioContext` ilk kullanıcı etkileşiminde (pointerdown/keydown, capture) oluşturulup hazır tutulsun. Chrome autoplay kuralı ancak böyle izin verir.
     - Context askıdaysa `resume()` dene; çalmazsa sessizce yalnız başlık uyarısına düş.
   - **Başlık:** `document.title`'ı "🔔 " + i18n metni yap (EN "Your turn", TR "Sıra sende"). `visibilitychange`/`focus` ile sekmeye dönülünce eski başlığı geri koy. Oyun başlığı değiştirirse onu ezme: geri koyarken güncel başlıktan öneki çıkar.
   - Ayar: `settings.alert` (varsayılan `true`), `chrome.storage.onChanged` ile canlı.
2. **Arka plan kısıtlaması (önemli):** Chrome, 5 dakikadan uzun gizli kalan sayfalarda zincirli zamanlayıcıları dakikada bire kadar yavaşlatır (intensive wake-up throttling).
   - game-hook şu an snapshot'ı `setInterval` ile 1 sn'de bir yayınlıyor; gizli sekmede uyarı dakikalarca gecikebilir.
   - Faz/seçim/carousel değişimini olay tabanlı yakala:
     - Redux `store.subscribe` ya da mevcut Colyseus durum kancası; değişince hemen yayınla.
     - `setInterval` yedek olarak kalsın.
   - Performans korunmalı:
     - Değişim kontrolü yalnız `phase`, `choices[0]?.id`, `carousel` varlığı ve `stage` üzerinden ucuz bir anahtarla yapılsın.
     - Tam snapshot yalnız anahtar değişince erken gönderilsin.
     - Mevcut `timed(...)` perf bekçisini kullan.
3. **Popup:** "Arka plandayken sesli uyarı" anahtarı (`settings.alert`), i18n EN+TR. `background.js` `DEFAULT_SETTINGS`'e `alert: true` ekle.
4. **Testler** (yeni `tests/alert.test.mjs`): `alert.js` sahte `window`/`document`/`AudioContext`/`chrome` ile `vm` içinde çalışsın (replay.test'teki recorder deseni). Doğrulananlar:
   - Gizliyken faz 1→0 geçişinde bir ses, yeni seçim kartında bir ses.
   - 3 sn içinde ikinci tetik ses çıkarmaz.
   - Görünürken ses yok.
   - Ayar kapalıyken ses yok.
   - Başlık değişir ve görünür olunca geri gelir.
   - AudioContext yoksa ya da askıdaysa hata fırlatmaz.
   - Gerçek kayıt `tests/fixtures/games/real-20261020-1952.json` sırayla oynatılıp (hidden=true) toplam uyarı sayısı makul aralıkta olsun. Beklenen: aşama sayısı kadar, seçimler birleşince biraz daha az. Bulduğun sayıyı raporla.
   - game-hook değişikliği için `planner-bridge`/mevcut hook testlerinde erken yayın davranışını sına.

## Scope

- In:
  - `extension/content/alert.js` (yeni), `extension/manifest.json` (content_scripts; **permissions değişmez**)
  - `extension/page/game-hook.js` (yalnız erken yayın), `extension/popup/*`, `extension/background.js` (varsayılan ayar)
  - `extension/i18n/en.json`, `tr.json`
  - `tests/alert.test.mjs`, game-hook testinde küçük ek
- Out:
  - advisor, panel, overlay, planner, carousel
  - Sistem bildirimi (`chrome.notifications` izin gerektirir, eklenmeyecek)
  - Ses dosyası

## Acceptance criteria

- [ ] `node --check` tüm JS; manifest JSON geçerli ve `permissions` aynı; `node --test tests/*.test.mjs` geçer (i18n eşitliği dahil); `npm run eval` 56.84%.
- [ ] Gizli sekmede her tetik türü için tam bir ses; 3 sn birleştirme; görünürken ve ayar kapalıyken ses yok (test).
- [ ] Faz/seçim değişimi game-hook'tan interval beklemeden yayınlanır (test).
- [ ] Gerçek kayıt oynatmasında uyarı sayısı raporda.

## Notes

- Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme.
- extension/manifest.json CRLF satır sonlu: düzenlerken satır sonlarını koru.
- Satır içi Türkçe blok yorum (`/* */`) yasak (i18n testi); `//` kullan.
- Eklenti oyunda hiçbir şeye tıklamaz.
