# d1-advice-engine — Seçim ekranları için öneri motoru (starter dahil)

- Summary: Oyunun yeni "seçim" sistemini (starter, ek Pokémon, eşsiz, efsanevi, item) okuyup her seçenek için yeşil/nötr/kırmızı karar ve Türkçe gerekçe üreten öneri motoru.
- Engine: codex
- Model: deep
- Phase: D1
- Branch: `codex/d1-advice-engine` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Starter seçiminde ve diğer seçim pencerelerinde eklenti hiç öneri göstermiyordu. Kök neden: oyun
seçimleri artık `player.choices` (Colyseus `PlayerChoice` şeması) üzerinden gösteriyor; eklentinin
okuduğu `game.pokemonsProposition` / `game.itemsProposition` alanları oyunda artık YOK. Bu WP
seçimleri doğru kaynaktan okur ve tahta üstü overlay'in (ayrı WP: d1-board-overlay) kullanacağı
seçenek-başına karar API'sini yazar.

## Oyunun gerçek yapısı (kaynak: github.com/keldaanCommunity/pokemonAutoChess, master)

`app/models/colyseus-models/player-choice.ts`:
```ts
type PlayerChoiceType = "item" | "addPick" | "starter" | "unique" | "legendary" | "mission_order" | "wand" | "gifts" | "form_change"
class PlayerChoice extends Schema {
  id: string; type: PlayerChoiceType
  items: Item[]            // item seçiminde seçenekler; Pokémon seçiminde items[i] = i. Pokémonla gelen bonus item (olabilir/olmayabilir)
  pokemons: PkmProposition[]  // Pkm adı ya da PkmDuo anahtarı (ör. "LATIOS_LATIAS")
  costs: number[]
}
```
- `Player.choices` = `ArraySchema<PlayerChoice>`. Oyun ekranda sadece `choices[0]`'ı gösterir.
- Pokémon seçimi varsa (`pokemons.length > 0`) seçenekler `pokemons`, yoksa `items`.
- Starter (`type: "starter"`) aşama 0'da, ortak (COMMON) havuzdan gelir (özel kurallarda eşsiz havuz).
- Redux'ta `state.game.players[i].choices` de var (selectConnectedPlayer); canlı Colyseus oyuncusu `live` tercih edilir.

## Scope

- In: `extension/page/game-hook.js`, `extension/content/advisor.js`
- Out: overlay / panel / manifest / popup / css dosyaları (başka WP). `translations/`, `scripts/build-translation.mjs` dokunulmaz.

## Tasks

1. `game-hook.js` → `snapshot()` çıktısına ekle:
   `choices: [{ id, type, pokemons: string[], items: string[], costs: number[] }]` (canlı oyuncu
   `live.choices`, yoksa `reduxPlayer.choices`; `toArray` ile düz diziye çevir).
   Geriye dönük uyum: `pokemonsProposition` = ilk Pokémon seçiminin `pokemons` dizisi (yoksa eski
   alan / boş), `itemsProposition` = ilk `type === "item"` seçiminin `items` dizisi (yoksa eski alan /
   boş). Böylece mevcut panelin "Pokémon seçimi" ve "Item seçimi" bölümleri tekrar çalışır.
2. `advisor.js` → `window.PacAdvisor.boardAdvice(ctx, snap)` ekle. Sözleşme (overlay buna göre yazılıyor, DEĞİŞTİRME):
   ```js
   boardAdvice(ctx, snap) => {
     choice: null | {
       id, type,                 // choices[0]
       kind: "pokemon" | "item",
       options: [{ index, verdict: "best" | "good" | "neutral" | "avoid", label: string, reasons: string[], score: number }]
     },
     shop: [{ index, verdict: "good" | "neutral", label: string, reasons: string[] }]   // sadece DEFAULT olmayan dükkan slotları
   }
   ```
   - `ctx` alanları: mevcutlar (`data, tierPokemons, clusters, minGames, thresholds`) + opsiyonel
     `tierItems` (meta.items[tier]: item -> [ortSıra, sayı, pokemons]) ve opsiyonel
     `names = { pkm(k), syn(k), item(k) }` (Türkçe/görünen ad). `names` yoksa ham anahtarı kullan.
   - `label`: kısa Türkçe rozet metni: best → "Önerilen", good → "İyi seçenek", avoid → "Kaçın", neutral → "".
   - `reasons`: en fazla 3 kısa Türkçe cümle parçası, ör. "Meta'da Charizard ort. 3.9 sıra",
     "Ateş sinerjini 4'e tamamlar", "Önerilen dizilimde var", "+ Leftovers (meta'da iyi item)",
     "Meta'da az oynanıyor / veri yok".
3. Puanlama:
   - Starter (`type === "starter"`): takım boş olduğundan meta ağırlıklı. Aile bazında (static.json
     `family`) en iyi ortalama sıra (`bestFamilyRank`, `minGames` üstü), ailenin meta dizilimlerde
     (count ≥ minGames, frequency ≥ 0.25) kaç kümede ve hangi en iyi küme sırasıyla geçtiği,
     ailenin toplam oyun sayısı (popülerlik, log ölçekli küçük bonus) ve `items[index]` bonus
     itemin meta sırası (`tierItems`). Duo ise üyelerin ortalaması.
   - `addPick`, `unique`, `legendary`, diğer Pokémon seçimleri: mevcut `fitScore` (sinerji tamamlama,
     dizilim uyumu, meta sırası) + bonus item.
   - `item` seçimi: mevcut `rankPropositions` mantığı (takımdaki Pokémonların istediği itemler,
     parça ise tarifte geçmesi) + `tierItems` meta sırası. `wand`, `gifts`, `form_change`,
     `mission_order` türleri için de `items` varsa aynı mantık, veri yoksa hepsi `neutral`.
   - Karar: en yüksek puan tek `best`; best'e yakın (fark ≤ %15 veya ≤ 0.5) olanlar `good`;
     belirgin şekilde kötü olan (best'ten en az 1.5 puan düşük VE meta sırası ≥ 4.6 ya da hiç veri
     yok) `avoid`; gerisi `neutral`. Tüm seçenekler eşitse (veri yok) hepsi `neutral`, best yok.
   - Dükkan: mevcut `shopAdvice` gerekçeleri + sinerjiyi bir sonraki eşiğe taşıyan Pokémon →
     `good`; gerisi `neutral` (dükkanda kırmızı yok).
4. Sözleşmeyi doğrulayan küçük bir node betiği yaz: `tests/advice.test.mjs` — `advisor.js`'i
   `globalThis.window = {}` ile `vm`/`import` üzerinden yükleyip `extension/data/static.json` ve
   sahte bir mini meta (birkaç Pokémon/küme/item) ile şu durumları sınar: starter (3–4 seçenek,
   tek best, en az bir avoid), duo içeren addPick, item seçimi, choices boş → `choice: null`,
   dükkan. `node tests/advice.test.mjs` exit 0 vermeli.

## Acceptance criteria

- [ ] `snapshot()` `choices` alanını üretir; `pokemonsProposition`/`itemsProposition` choices'tan türetilir.
- [ ] `PacAdvisor.boardAdvice` yukarıdaki sözleşmeyi birebir döndürür; mevcut `analyze`/`summarize` davranışı bozulmaz.
- [ ] Starter seçiminde takım boşken bile tek bir `best` ve gerekçeleri çıkar (veri varsa).
- [ ] `node tests/advice.test.mjs` geçer; AGENTS.md komutları (node --check, manifest JSON) geçer.
- [ ] Gerekçe metinleri Türkçe, kısa, `names` ile görünen adları kullanır.

## Notes

- `advisor.js` IIFE ve `window.PacAdvisor` global'ini kullanıyor; aynı stili koru (yorumlar Türkçe).
- `ctx.data.pokemons[name] = [nadirlik, yıldız, tipler, ekSeçim, bölgesel, aşamaSayısı, yetenekVar]`.
- Meta: `tierPokemons[name] = [ortSıra, oyunSayısı, ortItemSayısı, enÇokItemler]`, kümeler `{id,count,winrate,rank,synergies,pokemons:[{name,frequency,items}],items}`.
- Ağ çağrısı ekleme. Oyuna mesaj gönderme, tıklama yok.
