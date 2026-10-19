# d2-canvas-craft-highlight — Tahtada item birleştirme highlight'ı ve yüzde rozetleri

- Summary: Kartlarda "%NN" uyum rozeti; tahtada (canvas) birleştirilecek iki parçayı ve itemin takılacağı Pokémonu işaretleyen highlight; kısayolla aç/kapa.
- Engine: claude
- Model: deep
- Phase: D2
- Branch: `claude/d2-canvas-craft-highlight` (base: `main`)
- Depends on: d2-choice-percent sözleşmesi (paralel yazılıyor; alanlar yoksa sessizce çizme)
- Role: implementer

## Goal

Kullanıcı: "item birleştirmelerini bir kısayol olmalı, direkt highlight ile". Eklenti ASLA tıklamaz/sürüklemez; sadece hangi
parçayı hangi Pokémona sürükleyeceğini görsel olarak gösterir (oyunun kuralları otomasyonu yasaklıyor).

## Scope

- In: `extension/page/game-hook.js`, `extension/content/overlay.js`, `extension/content/overlay.css`, `tests/overlay-harness.html`.
- Out: advisor.js, panel.*, manifest, çeviri.

## advisor sözleşmesi (d2-choice-percent yazıyor)

`choice.options[i].pct` (0–100|null), `.tag`; `shop[i].pct`, `.tag`;
`craft: [{ item, components: [a, b], target, targetIndex, pct, reason }]` (targetIndex = snap.board indeksi).

## Oyun bilgisi (pokemonAutoChess master, app/public/src/game/)

- Phaser oyunu React içinde; `getGameScene()` (app/public/src/pages/game.tsx) GameScene döndürür. Sahne: `scene.board` (BoardManager,
  `pokemons: Map<id, PokemonSprite>`), oyuncunun eldeki itemleri `scene.itemsContainer` (ItemsContainer; çocuk ItemContainer'ların adı = Item).
  Doğru alan adlarını kaynaktan bul: `app/public/src/game/scenes/game-scene.ts`, `components/board-manager.ts`, `components/items-container.ts`,
  `components/pokemon.ts`. Kaynak: raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/... ya da lider kopyası
  `C:\Users\root\AppData\Local\Temp\claude\C--Users-root-Documents-projects-poke\2972d2d7-07fe-4e36-a887-bed4475d2b5f\scratchpad\pac`
  (`git -C <yol> sparse-checkout add app/public/src/game` ile game klasörünü ekleyebilirsin).
- Phaser oyun nesnesini sayfa ortamından bulma: React fiber (game-hook.js'teki findStoreInReact gibi), `window.Phaser?.GAMES` ya da başka sağlam yol.
- Ekran koordinatı: sprite dünya koordinatı → kamera/`game.scale` → `canvas.getBoundingClientRect()` içine.

## Tasks

1. `game-hook.js`: snapshot'a `screen` ekle (sadece kendi tahtan):
   `screen: { units: [{ name, x, y, index, rect:{left,top,width,height} }], items: [{ item, rect }] } | null`;
   `index` snap.board sırası (aynı Pokémondan iki tane olabilir: positionX/Y ile eşle). Konumlar canlı olsun (gerekirse ayrı 250 ms mesaj
   `pac-yardimci:screen`). Bulunamazsa `screen: null`, hata atma.
2. `overlay.js`: (a) seçim kartları ve dükkanda `pct` varsa rozete ekle ("✓ Önerilen · %82"), `tag` tooltip başlığında;
   (b) `advice.craft`: parça ikonlarına numaralı rozet (①②) + hedef Pokémona "→ ItemAdı" rozeti ve halka; tooltip "A + B → Item, Hedef'e sürükle".
   Birden çok tarif → farklı renk/numara. (c) Kısayollar: `Alt+I` craft highlight aç/kapa (varsayılan açık), `Alt+O` tüm overlay gizle/göster;
   `preventDefault` yalnız bu ikisi için; oyunun tuşlarına dokunma.
3. Savaş fazında craft highlight gizlensin. Döngü 100–250 ms.
4. `tests/overlay-harness.html`: sahte `screen` + `craft` + `pct` ile yeni "item birleştirme" senaryosu.

## Acceptance criteria

- [ ] Harness'te pct rozetleri ve craft highlight (parça numaraları + hedef halkası) görünür; tıklamalar engellenmez.
- [ ] `screen` hesaplanamazsa hiçbir şey kırılmaz.
- [ ] Alt+I / Alt+O çalışır, diğer tuşlar oyuna gider.
- [ ] AGENTS.md komutları geçer.
