# d4-tr-review — Oyunun Türkçe çevirisinin tamamını gözden geçir

- Summary: Gemini, oyunun ~5300 Türkçe metnini İngilizcesiyle karşılaştırıp kesin hataları düzeltir; terim seçimi gibi tartışmalı olanları ürün sahibinin onayına bırakır. Sonuç oyunun resmi reposuna tek PR olarak gidecek.
- Engine: agy
- Model: deep
- Phase: D4
- Branch: `codex/d4-tr-review` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

`translations/tr.partial.json` (oyunun Türkçe çevirisi, yapay zekâ ile üretildi, kimse okumadı) oyunun resmi reposuna PR olarak gidecek.
Bakımcı kalite istiyor. Kesin hatalar düzeltilmiş, tartışmalı her şey ürün sahibine sorulacak bir listeye dökülmüş olmalı.

## Scope

- In: `translations/tr.partial.json` (düzeltmeler), yeni `translations/review/tr-review.json` (rapor), yeni `translations/review/glossary.tr.md` (terim sözlüğü).
- Out: İngilizce dosyalar (`translations/en-*.snapshot.json`), `extension/` altındaki her şey, `scripts/`. Anahtar ekleme ya da silme yok; sadece değerler değişir.

## Tasks

1. Kaynaklar: İngilizce = `translations/en-master.snapshot.json` + `translations/en-live.snapshot.json` (canlıda olup master'da olmayan anahtarlar).
   Türkçe = `translations/tr.partial.json` (aynı iç içe yapı; `$comment` anahtarı açıklamadır, çeviri değildir, dokunma).
2. Önce **terim sözlüğü** çıkar (`glossary.tr.md`): oyunda tekrar eden terimler (stat adları ATK/DEF/SPEED/AP/PP/SHIELD, durumlar BURN/FREEZE/…,
   sinerjiler, technical_terms, "item", "reroll", "shop", "board/bench", "stage", "carousel", "Elo" vb.) ve çeviride şu an hangi Türkçe karşılıkların kullanıldığı.
   Aynı İngilizce terim için birden fazla Türkçe karşılık varsa bunu bir tutarsızlık olarak işaretle.
3. Bölüm bölüm (üst seviye anahtarlar, `pkm`, `item`, `item_description`, `ability_description`, `passive_description`, `synergy_description`, `status_description`, … ) her metni İngilizcesiyle karşılaştır.
4. **Doğrudan düzelt** (tr.partial.json'a uygula) — sadece nesnel hatalar:
   - bozulmuş ya da eksik kalıplar: `{{değişken}}`, BÜYÜK_HARF oyun kalıpları (SHIELD, ON_HIT, ATK, synergy anahtarları…), `[50,LK]`/`[...,SP]` gibi köşeli kalıplar;
     bir kalıbın hemen arkasına yapışmış Türkçe ek (`SHIELDı` → `SHIELD olarak` gibi, çünkü oyun kalıbı sınırla tanır);
   - yazım ve dilbilgisi hataları, yarım kalmış ya da çevrilmemiş (İngilizce kalmış) cümleler;
   - anlamı İngilizcesiyle açıkça çelişen çeviriler (sayı, yön, kim-kime yanlış: "düşmana" yerine "müttefike" gibi).
   Her düzeltmeyi rapora `"decision": "applied"` ile yaz.
5. **Uygulama, sor** (`"decision": "ask"`) — öznel ya da tartışmalı olanlar:
   - terim seçimleri ve sözlükteki tutarsızlıklar (tek kayıt, etkilediği anahtar sayısıyla, önerdiğin seçenekle birlikte);
   - Pokémon/item/yetenek adlarının çevrilip çevrilmeyeceği (oyunun Türk oyuncuları İngilizce adları kullanır; şu anki kural: Pokémon ve item adları İngilizce kalır);
   - anlamı belirsiz İngilizce metinler, oyun bilgisi gerektiren yorumlar, üslup tercihleri.
   Benzer kayıtları birleştir; "ask" listesi en fazla ~60 kayıt olsun ve en etkili olanlar başta gelsin.
6. Rapor biçimi `translations/review/tr-review.json`:
   `{ "summary": {"checked": n, "applied": n, "ask": n}, "items": [ { "id": "r1", "decision": "applied"|"ask", "kind": "placeholder"|"typo"|"grammar"|"meaning"|"untranslated"|"terminology"|"naming"|"style"|"ambiguous", "keys": ["item_description.SOUL_DEW", …], "en": "…", "tr_before": "…", "tr_after": "…" (applied ise), "options": ["…","…"] (ask ise; ilki önerin), "reason": "Türkçe kısa açıklama" } ] }`
7. Kontrol: `node scripts/build-translation.mjs --en translations/en-master.snapshot.json --en-live translations/en-live.snapshot.json` çalıştır.
   Çevrilen oran düşmemeli ve "kalıplar eksik" uyarısı **sıfır** olmalı. Çıktısını raporuna ekle.
   Bu komut `extension/locales/tr/translation.json` dosyasını yeniden üretir; o dosya kapsam dışı, değişikliğini geri al (`git checkout -- extension/locales`) — lider kendi üretecek.

## Acceptance criteria

- [ ] `tr.partial.json` geçerli JSON, anahtar seti değişmemiş (sadece değerler).
- [ ] build-translation çıktısında kalıp uyarısı 0; çevrilen oran ≥ önceki (%100.0, 5284/5286).
- [ ] `tr-review.json` şemaya uygun; her "applied" kaydının `tr_after` değeri tr.partial.json'daki değerle aynı.
- [ ] "ask" kayıtları ≤ ~60, birleştirilmiş, her birinde seçenekler ve önerilen seçenek var.
- [ ] `glossary.tr.md` terim → kullanılan Türkçe karşılık(lar) → önerilen tek karşılık tablosu.

## Notes

- Oyunun açıklama kalıpları `app/public/src/pages/utils/descriptions.tsx` (upstream) ile ikon/etikete çevrilir; kalıp sınırı `\W` ister.
- Türk oyuncu topluluğu: Pokémon, item ve yetenek adlarını İngilizce kullanır; sinerji/tip adları Türkçe (Ateş, Su, Çimen…) şu an kullanılıyor.
- Ürün sahibi ana dili Türkçe olan bir oyuncu; "ask" listesini o cevaplayacak, kısa ve anlaşılır yaz.
