# d8-eval — Öneri motorunu gerçek kazanan takımlarla ölçen değerlendirme ve ağırlık arama

- Summary: Meta raporundaki 768 kazanan takımdan otomatik "sınav soruları" üretip öneri motorunun doğru seçimi ne sıklıkla yaptığını ölçen bir değerlendirme betiği ve ağırlıkları bu puanı en yükseğe çıkaracak şekilde arayan bir mod. Ürün sahibi her değişikliği oyunda gözle test edemiyor; bu, kalitenin otomatik ölçüsü olacak.
- Engine: codex
- Model: deep
- Phase: D8
- Branch: `codex/d8-eval` (base: `main`)
- Depends on: none (d8-context paralel; `PacAdvisor.WEIGHTS` ve `ctx.weights` sözleşmesi orada — yoksa betik mevcut API ile ağırlıksız çalışmalı)
- Role: implementer

## Veri

- `tests/fixtures/meta.json` — sıkıştırılmış gerçek meta: `{ clusters: [{ id, count, rank, winrate, synergies, pokemons: [{name, frequency, items}], items, topTeams: [{ rank, elo, pokemons: [{name, items}] }] }], pokemons: {tier: {pkm: [rank, count, itemCount, items]}}, items: {tier: {item: [rank, count, holders]}}, regions, thresholds }`. 128 dizilim × 6 kazanan takım = 768 takım.
- `extension/data/static.json` — tipler, aileler, tarifler, bileşenler, kurallar.

## Tasks

1. `scripts/eval-advice.mjs` (Node, bağımlılıksız; `extension/content/advisor.js`'i `vm` içinde yükler):
   - Belirlenimci tohumlu RNG (`--seed`, varsayılan 1).
   - **T1 Pokémon seçimi (leave-one-out):** her kazanan takımdan bir birimi çıkar (efsanevi/eşsiz olmayanlar öncelikli), kalan takımı tahtaya diz (y=3..1, x sırayla), seçenekler = çıkarılan + aynı nadirlikten 2 rastgele (tahtadakilerin ailesinden olmayan) Pokémon; `boardAdvice` ile sahte bir seçim kartı (`choices: [{ type: "addPick", pokemons: [...] }]`) puanlat; ölç: top-1 doğruluk, MRR.
   - **T2 Item seçimi:** bir birimden bir item çıkar; seçenekler = çıkarılan + 2 rastgele üretilebilir item; `choices: [{ type: "item", items }]`; ölç top-1, ve API taşıyıcı döndürüyorsa taşıyıcı doğruluğu.
   - **T3 Dizilim:** takımın ilk k birimi (k=3, 5) → `analyze(...).comps` ilk 3'ünde takımın kendi dizilimi (cluster id) var mı.
   - **T4 Ortak Seçim:** T2 gibi ama `rankCarousel` ile 8 seçenek (çıkarılan + 7 rastgele bileşen/item).
   - Rastgele seçim taban çizgisi (beklenen top-1 = 1/seçenek sayısı) ile birlikte bir tablo yazdır; `--json` ile makine okunur çıktı.
   - Elo seviyesi `--tier` (varsayılan: d8-context'in "auto" kuralına uygun LOVE_BALL; yoksa LOVE_BALL kullan).
2. `--grid` modu: `PacAdvisor.WEIGHTS` varsa anahtarları üzerinde koordinat-iniş (her anahtar için ×0.5, ×0.75, ×1.25, ×1.5, ×2 dene, en iyi ağırlıklı ortalamayı tut, 3 tur) — amaç: T1, T2, T4 top-1 ve T3 recall@3 ortalaması. **Aşırı uyumu önle:** takımları tohumla eğitim/doğrulama (%70/%30) olarak ayır, aramayı eğitimde yap, doğrulamayı raporla. En iyi ağırlıkları JSON olarak yazdır (koda yazmaz; lider karar verir).
3. `tests/eval.test.mjs`: hızlı alt küme (ör. 120 takım) ile her görevde motorun rastgele taban çizgisinden belirgin iyi olduğunu ve betiğin hatasız çalıştığını doğrular (regresyon kalkanı). Eşikleri mevcut motorun ölçülen değerinin biraz altına koy ve dosyada gerekçesiyle yaz.
4. `package.json`: `"eval": "node scripts/eval-advice.mjs"` betiği.
5. Raporuna: mevcut motorun (main) taban ölçümleri tablosu.

## Scope

- In: `scripts/eval-advice.mjs`, `tests/eval.test.mjs`, `package.json`.
- Out: `extension/` altındaki her şey (d8-context değiştiriyor), `tests/fixtures/` (salt okunur).

## Acceptance criteria

- [ ] `node scripts/eval-advice.mjs` tabloyu basar; `--json`, `--grid`, `--seed`, `--tier` çalışır; aynı tohumla aynı sonuç.
- [ ] `node --test tests/*.test.mjs` geçer.
- [ ] Rapor: main'in taban ölçümleri + grid'in (WEIGHTS yoksa "atlandı") sonucu.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme; sadece fixture.
