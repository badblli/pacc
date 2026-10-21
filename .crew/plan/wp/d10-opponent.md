# d10-opponent — Sıradaki rakibi oyunun eşleştirme kuralıyla tahmin et

- Summary: Hazırlık sırasında koç, bir sonraki savaşta kimle eşleşeceğini yüzdeyle söyler (ör. "Kenji %67, Mira %33"). Hesap oyunun kendi açık kaynak eşleştirme kuralının birebir kopyasıdır. Her adayın canı, birim sayısı, en güçlü sinerjileri ve güçlü birimleri de verilir. Sıradaki tur vahşi Pokémon (PvE) turuysa bunu söyler.
- Engine: codex
- Model: deep
- Phase: D10
- Branch: `codex/d10-opponent` (base: `main`)
- Depends on: none (d10-panel paralel; sözleşme aşağıda)
- Role: implementer

## Oyunun kuralı (app/core/matchmaking.ts, master; lider okudu)

`selectMatchups(state)`:

1. Canlı oyuncular. Her çift (A,B) için:
   - `count = A.opponents[B] + A.opponents["ghost-"+B] + B.opponents[A] + B.opponents["ghost-"+A]`
   - `distance = (A.history.length - A.history.findLastIndex(h => h.id === B || h.id === "ghost-"+B)) + (B için simetrik)`
   - `findLastIndex` bulamazsa -1 döner, yani hiç karşılaşmamışsa uzaklık `length + 1` olur.
2. Oyuncuları tam eşleyen bütün kombinasyonları üret.
   - Oyuncu sayısı tekse kalan oyuncu bir "hayalet" maçla eşlenir: kalan oyuncu mavi, diğer oyuncunun hayaleti kırmızıdır.
   - Hayalet maçta `count` ve `distance` yalnız kalan oyuncunun (A tarafının) değeridir.
3. Toplam `count`'u en düşük kombinasyonları tut.
4. Bunların içinden toplam `distance`'ı en yüksek olanları tut.
5. Kalanlar arasından rastgele bir tane seç (`pickRandomIn`).
   - Bizim olasılığımız: eşit ağırlıklı her kombinasyonda benim rakibim kim, onu say ve yüzdeye çevir.
6. Double Up modu (`doubleUpTeamId` dolu) bu WP'nin kapsamında değil: tespit edersen "bilinmiyor" dön.

**İstemcide `opponents` haritası yok** (sunucuya özel). Ama `history` senkron (`@type([HistoryItem])`: `id, name, result, avatar, weather`).
- `count`'u history'den yeniden kur: A'nın history'sinde id'si B ya da "ghost-"+B olan girişlerin sayısı.
- Varsayım: sunucu her savaşta `opponents`'ı artırırken history'ye de bir giriş ekler.
  - Hayalet maçta kırmızı taraf `opponents`'ını artırmaz.
  - Kaydı incele; history'deki hayalet girişinin id'si "ghost-…" mi düz id mi, bunu kayıt ve sınama verisiyle doğrula, raporda yaz.
- PvE turları (`app/models/pve-stages.ts` anahtarları): `1 2 3 9 14 19 24 28 32 36 40`.
  - Oyuncuların history'sine PvE girişleri de düşer (id bir oyuncu değil); oyuncu dışı id'leri yok say.
  - Snapshot'ın `stage` alanı oyunun `stageLevel` değeri. Hazırlıktaki stage bir sonraki savaşın stage'i mi, onu kayıttan doğrula: kayıtta stage 9'un savaşında rakip yoktu.

## Tasks

1. **game-hook.js:** snapshot'a `lobby` ekle (yeni anahtar; mevcut `players: sayı` kalsın).
   - Biçim: `lobby: [{ id, name, alive, life, history: [ids…], board: unitsOf(p) özeti (name, stars, items, x, y), synergies, doubleUpTeamId? }]`.
   - Kaynak: canlı `gs.players` (Colyseus), yoksa Redux `game.players`.
   - Ucuz tut: history yalnız id dizisi. Değişmeyen oyuncular için önceki nesneyi yeniden kullan (snapshot zaten JSON karşılaştırmasıyla gönderiliyor).
   - Mevcut `timed(...)` bekçisi 40 ms'yi aşmamalı.
2. **recorder.js anonimleştirme:** `lobby` içindeki `id`, `name` ve history id'leri (hayalet öneki korunarak, "ghost-p3" gibi) aynı p1..p7 eşlemesiyle anonimleşmeli. Kendi id'n her yerde "self". Avatar alanları atılır. Testle doğrula.
3. **advisor.js:** `PacAdvisor.nextOpponents(ctx, snap)`. Bu sözleşme d10-panel tarafından kullanılıyor, değiştirme:
   ```
   { kind: "pvp" | "pve" | "unknown",
     candidates: [{ id, name, pct, life, units, synergies: [[syn, n], …en çok 3], top: [{ name, stars }, …en çok 2] }] }  // pct azalan
   ```
   - Kombinasyon sayısı en çok 8 oyuncuda 105 (tekte hayaletli biraz fazla); snapshot başına önbellekle (`perSnap`).
   - `top` = yıldız × nadirlik/ meta sırasına göre en güçlü iki birim.
   - `synergies` = aktif eşiği olan en yüksek üç sinerji.
   - Hazırlık fazı dışında ya da veri yoksa `kind: "unknown"`, `candidates: []`.
4. **Testler** (`tests/opponent.test.mjs`, yeni):
   - `matchmaking.ts`'teki kuralı bağımsız, açık yazılmış küçük senaryolarla sına: 4 oyuncu, A-B iki kez karşılaşmış → A'nın rakibi B olamaz.
   - Uzaklık eşitliği bozar.
   - 3 oyuncu + hayalet.
   - Ölü oyuncular dışarıda.
   - PvE stage'i → `pve`.
   - Yüzdelerin toplamı 100.
   - Gerçek kayıt `tests/fixtures/games/real-20261020-1952.json` bu WP'den önce kaydedildi, `lobby` içermez. Bunun için sentetik bir lobi kur; kayıttaki gerçek rakip sırası (p1, p2, …) ile uyumlu bir örnekte tahminin gerçekleşen rakibi pozitif olasılıkla içerdiğini göster.
   - Replay testine `nextOpponents` çağrısı (< 50 ms, pct toplamı 100 ya da aday yok) ekle.
   - Recorder testine `lobby` anonimleştirmesini ekle.

## Scope

- In: `extension/page/game-hook.js`, `extension/content/recorder.js`, `extension/content/advisor.js` (yalnız yeni fonksiyon + dışa açma), `tests/opponent.test.mjs`, `tests/replay.test.mjs`, `tests/planner-bridge.test.mjs` (hook testi gerekirse).
- Out: panel/overlay/UI ve i18n dosyaları (d10-panel), manifest.

## Acceptance criteria

- [ ] `node --check` tüm JS; `node --test tests/*.test.mjs` geçer; `npm run eval` 56.84%.
- [ ] Kural testleri (sayı, uzaklık, hayalet, ölü, PvE, toplam %100) geçer.
- [ ] `lobby` anonimleştirmesi testle doğrulanır; kayıtta gerçek ad ya da id kalmaz.
- [ ] Rapor: hayalet history id biçimi ve stage/PvE eşlemesi hakkında bulduğun kanıt.

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Ağdan veri çekme. Satır içi Türkçe blok yorum yasak, `//` kullan. Eklenti hiçbir şeye tıklamaz.
