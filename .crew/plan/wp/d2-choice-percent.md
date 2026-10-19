# d2-choice-percent — Yüzdeli seçim önerisi, set uyumu ve item birleştirme planı

- Summary: Her seçeneğe "%NN uyum" puanı, takımla/meta ile uyum gerekçesi ve elindeki parçalarla hangi itemin kime yapılacağını gösteren birleştirme planı.
- Engine: claude
- Model: deep
- Phase: D2
- Branch: `claude/d2-choice-percent` (base: `main`)
- Depends on: none (d2-canvas-craft-highlight bu sözleşmeyi kullanıyor)
- Role: implementer

## Goal

Kullanıcı: "setimizdeki metaya uygun veya birbiriyle uyumlu olanları önermeli, hatta yüzdelerle belirtelim iyi seçim kötü seçim";
"ara turlarda item veya set de önermeli"; "item birleştirmelerini highlight ile göstermeli".

## Scope

- In: `extension/content/advisor.js`, `tests/advice.test.mjs`.
- Out: overlay, panel, game-hook, manifest, çeviri.

## Sözleşme (overlay bu alanları kullanacak; adları DEĞİŞTİRME, mevcut alanlar korunur)

`PacAdvisor.boardAdvice(ctx, snap)` çıktısına eklenecekler:
```js
choice.options[i].pct   // 0–100 tam sayı ya da null: seçeneğin uyum puanı
choice.options[i].tag   // kısa etiket: "Meta + takım" | "Takım uyumu" | "Meta güçlü" | "Zayıf seçim" | "Veri yok"
shop[i].pct             // dükkan slotu için aynı ölçekte puan (good olmayanlar için de), shop[i].tag
craft: [{ item, components: [a, b], target, targetIndex, pct, reason }]
//  item: yapılacak item; components: eldeki iki parça; target: tahtadaki Pokémon adı;
//  targetIndex: snap.board içindeki indeks; reason: kısa Türkçe ("Charizard için meta item, ort. 3.2 sıra")
```

## Tasks

1. `pct`: mutlak anlamı olan ağırlıklı toplam, 0–100'e kırp. Meta bileşeni: aile en iyi ortalama sırası / item meta sırası doğrusal (1→100, 4.5→50, 8→0). Takım bileşeni: sinerji eşiğini tamamlama, aynı aile kopyası (evrim), oyuncunun tahtasıyla örtüşen meta dizilimin çekirdeğinde olma. Bonus item katkısı. Starter'da takım yok → meta ağırlıklı. Veri yoksa `pct: null`, tag "Veri yok".
2. Kararlar pct ile tutarlı: best en yüksek pct; avoid için pct ≤ 40 VE best'ten ≥ 25 puan düşük.
3. Gerekçelerde set uyumunu açık yaz: "Su 2→3 (tamamlar)", "Tahtandaki Squirtle ile aynı dizilim (ort. 3.4)", "Dizilim çekirdeği: Lapras, Gyarados". En fazla 3, en önemlisi önce. `ctx.names` ile görünen adlar.
4. Item seçimi (PvE ödülü / ara tur, `type: "item"`) için de pct + tag + gerekçe (mevcut itemPlan mantığı).
5. `craft`: `snap.inventory` parçalarıyla yapılabilen ve tahtadaki (y>0) bir Pokémonun meta'da en çok kullandığı 3 itemden biri olan itemler için en iyi hedef (yıldızı yüksek, item sayısı <3, aynı itemi takmamış). Her parça tek tarifte (açgözlü, en yüksek pct önce). Envanter yoksa `craft: []`.
6. Testleri genişlet: starter pct sırası, takım uyumunun pct'yi artırması, avoid eşiği, item seçimi pct, craft (parça çakışması dahil), envanter yok.

## Acceptance criteria

- [ ] Sözleşme alanları her durumda var (null/boş olabilir); eski alanlar, `analyze`/`summarize` bozulmamış.
- [ ] Takıma uyan seçeneğin pct'si belirgin artar (test).
- [ ] `craft` parça başına tek kullanım, hedef tahtadaki Pokémon.
- [ ] `node tests/advice.test.mjs` ve AGENTS.md komutları geçer.
