# d5-planner-bridge — Oyunun Team Planner'ı ile köprü (oku + plana yükle)

- Summary: Eklenti oyunun Takım Planlayıcısı'ndaki planı okur, planlayıcının açık olup olmadığını ve ekrandaki yerini bilir, kullanıcı isteyince bir dizilimi planlayıcıya oyunun kendi fonksiyonuyla yükler.
- Engine: codex
- Model: deep
- Phase: D5
- Branch: `codex/d5-planner-bridge` (base: `main`)
- Depends on: none (d5-planner-advice ve d5-planner-ui ile paralel; aşağıdaki mesaj protokolü sözleşmedir)
- Role: implementer

## Goal

`extension/page/game-hook.js` (MAIN world) oyunun planlayıcısıyla konuşan küçük bir köprü kazanır. UI tarafı (d5-planner-ui) sadece aşağıdaki postMessage protokolünü kullanır.

## Oyunun gerçek davranışı (upstream kodu, keldaanCommunity/pokemonAutoChess master)

- Plan `localStorage["team_planner"]` içinde, biçim: `{"expirationDate": <ms>, "value": IDetailledPokemon[]}`; `IDetailledPokemon = {name: Pkm, x: 0..7, y: 1..3, items: Item[], emotion?, shiny?}` (y=3 rakibe en yakın ön sıra, y=1 arka sıra, y=0 yedek; planner yedeği göstermez).
- Oyun `localStore.set` sonrası `window.dispatchEvent(new StorageEvent("storage", {key:"team_planner", newValue: value}))` yapar; dükkan (`game-store.tsx`) ve seçim ekranı (`game-choice.tsx`) bu olayla planı yeniden okur ve plandaki Pokémonları "planned" olarak işaretler.
- `TeamBuilderModal` HER ZAMAN mount'lu (sadece `show` değişir) ve tahtayı `useState(localStore.get(...))` ile SAYFA AÇILIŞINDA bir kez okur, sonra her değişiklikte localStorage'a yazar. Yani localStorage'a doğrudan yazmak planlayıcının ekrandaki tahtasını güncellemez ve sonraki düzenlemede üzerine yazılır.
- Planlayıcı açıkken DOM: `dialog.modal.team-builder-modal[open]` içinde `#team-builder` (grid alanları: synergies, actions `.actions`, board `#team-editor`, selected, pokemons = Pokémon seçici (react-tabs `.react-tabs`), items). `#team-builder` öğesinin React fiber'ı (`Object.keys(el).find(k=>k.startsWith("__reactFiber$"))`) üzerinden `.return` zincirinde `memoizedProps.updateBoard` fonksiyonu olan ilk fiber TeamBuilder'dır; `props.updateBoard(board)` modalın state'ini günceller → oyun kendi localStorage + storage olayını tetikler.

## Mesaj protokolü (sözleşme — isimleri aynen kullan)

- MAIN → content, değiştiğinde ve `pac-yardimci:hello` gelince: `{type: "pac-yardimci:planner", planner: {open: bool, board: IDetailledPokemon[], rects: {modal, actions, picker, board} | null}}`. `rects` = `getBoundingClientRect()` değerleri `{x,y,w,h}` (açık değilse null). Saniyede en fazla birkaç kez; değişmediyse yollama (JSON karşılaştır). Pencere boyutu/scroll değişince rect'leri güncelle (ResizeObserver veya mevcut interval).
- content → MAIN: `{type: "pac-yardimci:planner-set", board: IDetailledPokemon[], requestId}` → yanıt `{type: "pac-yardimci:planner-set-result", requestId, ok: bool, via: "react"|"storage", error?}`.
  - Planlayıcı açık ve fiber bulunduysa `updateBoard(board)` çağır (`via:"react"`).
  - Değilse localStorage'a oyunun biçimiyle yaz (`expirationDate` = mevcut değer varsa onu koru, yoksa şimdi + 30 gün) ve oyunun yaptığı gibi StorageEvent yolla (`via:"storage"`); bu durumda yanıtta `note: "reopen"` ekle (planlayıcı tahtası sayfa yenilenene kadar eski kalabilir — UI kullanıcıya söyler).
  - Gelen board'u doğrula: dizi, en fazla 24 eleman, `name` string, `x` 0..7, `y` 1..3 tamsayı, `items` en fazla 3 string; geçersizse `ok:false`.
- Sadece `e.source === window` ve bu tiplerdeki mesajları dinle. Oyuna ağ mesajı gönderme, oyunda hiçbir şeye tıklama.

## Scope

- In: `extension/page/game-hook.js`, `tests/` (yeni `planner-bridge.test.mjs`: doğrulama ve biçim fonksiyonlarını saf fonksiyon olarak dışa aç ya da kopyalayıp test et).
- Out: content script'ler, manifest, i18n, advisor.

## Acceptance criteria

- [ ] `node --check extension/page/game-hook.js`; `node --test tests/*.test.mjs` geçer.
- [ ] Planlayıcı açık/kapalı geçişinde `pac-yardimci:planner` mesajı doğru `open` ve `rects` ile gelir; board localStorage'daki `value` ile aynıdır.
- [ ] `planner-set` açıkken React yoluyla, kapalıyken storage yoluyla çalışır; geçersiz board reddedilir.
- [ ] Mevcut `pac-yardimci:game` / `screen` / `health` mesajları değişmeden çalışır.

## Notes

Kod yorumları Türkçe (dosyanın geri kalanı gibi). Git komutu çalıştırma; lider commit'ler.
