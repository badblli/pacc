# d1-team-aware-advice — Tahtaya göre öneri

- Summary: Tahtadaki Pokémonların ve sinerjilerin öneri kararlarına açık biçimde yansıması.
- Engine: codex
- Phase: D1
- Branch: `codex/d1-team-aware-advice` (base: `main`)
- Role: implementer

## Scope

- In: `extension/content/advisor.js`, `extension/page/game-hook.js`, `tests/advice.test.mjs`, bu WP.
- Out: overlay, panel, popup, manifest, çeviri ve veri dosyaları.

## Tasks

1. Canlı sinerji alanı boş veya kullanılamazsa tahtadaki aktif Pokémonların türlerinden sinerji sayısını çıkar.
2. Pokémon seçimlerinde takım uyumunu meta puanından ayırt edilebilir hale getir; tahta değişince uygun seçenek ve Türkçe gerekçe değişsin.
3. Dükkan işaretlerini takımın mevcut sinerjileriyle eşleştir; yalnızca eşik tamamlama durumuna bağlı bırakma.
4. Kanca ve motor için tahta değişimini sınayan testler ekle.

## Acceptance criteria

- [ ] Aynı seçenekler için farklı tahtalar farklı sıralama/gerekçe üretebilir.
- [ ] Boş sinerji alanında tahta türleri kararları besler.
- [ ] Dükkan uyumlu Pokémonu `good` olarak işaretler, `avoid` kullanmaz.
- [ ] Starter seçimi takımsız meta davranışını korur; eski panel API'leri çalışır.
- [ ] `node tests/advice.test.mjs` ve AGENTS.md komutları geçer.
