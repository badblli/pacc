# d8-recorder — Gerçek maçı kaydet, testlerde tekrar oynat

- Summary: Popup'taki bir geliştirici seçeneğiyle oyuncunun bir maçı boyunca eklentinin gördüğü bütün oyun durumları kaydedilir ve tek dosya olarak indirilir. Bu dosyalar testlerde ve test sayfasında tekrar oynatılır. Ürün sahibi her değişikliği oyunda gözle test edemiyor; bir kere kaydedilen maç, sonraki her değişikliğin otomatik testi olur.
- Engine: codex
- Model: standard
- Phase: D8
- Branch: `codex/d8-recorder` (base: `main`)
- Depends on: d8-context, d8-eval (main'de)
- Role: implementer

## Tasks

1. **Kayıt (varsayılan kapalı):** popup'ta "Maçı kaydet (geliştirici)" anahtarı (`settings.record`, i18n EN+TR) ve "Kaydı indir (n durum)" / "Kaydı sil" düğmeleri.
   - Açıkken content tarafı (yeni küçük `extension/content/recorder.js`, manifest'te diğer content script'lerle) `pac-yardimci:game`, `pac-yardimci:screen`, `pac-yardimci:planner` mesajlarını zaman damgasıyla toplar; ardışık aynı yükleri atlar; IndexedDB ya da `chrome.storage.local`'da tutar (üst sınır ~8 MB, aşınca en eskiyi at). Kayıt kişisel veri içerebilir: oyuncu adları/uid **anonimleştirilir** (uid → "self", diğer oyuncu adları → "p1..p7", avatar alanları atılır).
   - İndirme: `{ format: 1, recordedAt, extensionVersion, gameVersion?, events: [{ t, type, payload }] }` JSON; dosya adı `pacc-game-YYYYMMDD-HHMM.json`. İndirme kullanıcının tıklamasıyla, `chrome.downloads` izni EKLEMEDEN (popup'ta Blob + `<a download>`).
2. **Tekrar oynatma testi:** `tests/fixtures/games/` altındaki her kayıt için `tests/replay.test.mjs`: her `game` olayında `buildContext` + `analyze`, `boardAdvice`, `rankCarousel`/`rankPortals` (carousel varsa), `planFit/planRecommendations` (plan varsa) çalışır; değişmezler: hata yok, yüzdeler 0–100, seçenek indeksleri geçerli, her çağrı < 50 ms (performans regresyonu). Klasör boşsa test atlanır (skip) ama sentetik küçük bir örnek kayıtla da çalıştığını göster (`tests/fixtures/games/sample-synthetic.json`, elle üretilmiş, gerçekçi şekilde).
3. **Tekrar oynatma sayfası:** `tests/replay-harness.html`: bir kayıt dosyası seçilir (input type=file) ya da `?file=` ile fixture yüklenir; zaman çubuğuyla olaylar arasında gezilir; panel/overlay/carousel/planner content script'leri sahte `chrome` ile yüklenir ve o anki duruma göre çizer (mevcut harness'lardaki shim desenini kullan). Overlay konumları kayıttaki `screen` olaylarından gelir.
4. README'ye (EN+TR) kısa "Bir maçı kaydedip geliştiricilere göndermek" bölümü.

## Scope

- In: yeni `extension/content/recorder.js`, `extension/manifest.json`, `extension/popup/*`, `extension/i18n/en.json`, `tr.json`, `tests/replay.test.mjs`, `tests/replay-harness.html`, `tests/fixtures/games/sample-synthetic.json`, `README.md`, `README.tr.md`.
- Out: advisor ve diğer content script'lerin mantığı.

## Acceptance criteria

- [ ] `node --check` tüm JS, manifest JSON, `node --test tests/*.test.mjs` geçer (i18n eşitliği dahil).
- [ ] Kayıt kapalıyken hiçbir şey saklanmaz; açıkken ardışık aynı yükler saklanmaz; anonimleştirme testle doğrulanır.
- [ ] Yeni izin eklenmez (manifest `permissions` değişmez).

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma.
