# d2-tr-live-keys — Canlı sitedeki eksik 109 çeviri anahtarı

- Summary: Oyunun canlı sürümünde (V6.11.2) olup Türkçe dosyada olmayan 109 metni çevirmek ve derleme betiğinin canlı sürümü de hesaba katmasını sağlamak.
- Engine: agy
- Model: standard
- Phase: D2
- Branch: `codex/d2-tr-live-keys` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Eklenti oyunun `locales/en/translation.json` isteğini TÜM dosyayla değiştiriyor. Türkçe dosya GitHub master'daki İngilizce
dosyadan üretildiği için, canlı sitede kullanılan ama master'da olmayan 109 anahtar oyunda eksik görünüyor (bot oluşturucu,
dükkan/seviye ipuçları, zafer/yenilgi sayaçları vb.).

## Scope

- In: `translations/tr.partial.json`, `scripts/build-translation.mjs`; girdi olarak sadece oku: `translations/live-missing.en.json`, `translations/en-live.snapshot.json`.
- Out: `extension/` altındaki her şey. `extension/locales/tr/translation.json` dosyasını ÜRETME; lider `npm run build:tr` ile üretecek.

## Tasks

1. `translations/live-missing.en.json` içindeki 109 anahtarı (düz "a.b.c" yolları; üst düzey olanlar tek kelime) Türkçeye çevir ve `translations/tr.partial.json` içinde doğru iç içe konuma ekle. Mevcut anahtarlara dokunma; yenileri ilgili bölümün sonuna ekle.
2. Kurallar: `{{değişken}}`, `[50,LK]` ve BÜYÜK_HARF kalıplar (SHIELD, ATK, GOLD...) AYNEN kalır; kalıba ek yapıştırma ("SHIELDı" yanlış, "SHIELD olarak" doğru). Pokémon / item / yetenek / harita adları İngilizce kalır. `_one`/`_other` çoğullarının ikisini de doldur. Gündelik, kısa, oyun arayüzüne uygun Türkçe.
3. `scripts/build-translation.mjs`: İngilizce taban, master dosyası ile canlı sitenin dosyasının (`https://pokemon-auto-chess.com/locales/en/translation.json`) BİRLEŞİMİ olsun (anahtar birinde varsa çıktıda olsun; değer önceliği canlı site). `--en-live yol.json` ile yerel dosya verilebilsin. Canlı dosya indirilemezse uyarı yazıp yalnız master ile devam etsin. İstatistikte "canlı sitede olup master'da olmayan anahtar sayısı" da yazsın.
4. Ağ yoksa: `node --check scripts/build-translation.mjs` ve `node -e "JSON.parse(require('fs').readFileSync('translations/tr.partial.json','utf8'))"` ile doğrula.

## Acceptance criteria

- [ ] 109 anahtarın hepsi `tr.partial.json` içinde, Türkçe, kalıpları korunmuş.
- [ ] `tr.partial.json` geçerli JSON; diff sadece eklemeler.
- [ ] Build betiği canlı + master birleşimini kullanıyor; `--en-live` seçeneği var.
- [ ] AGENTS.md komutları geçer.
