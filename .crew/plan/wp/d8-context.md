# d8-context — Önerileri oyuncunun gerçek takımına ve planına bağla

- Summary: Öneriler, planlayıcıdaki plan izleniyorsa plana, izlenmiyorsa tahtadaki gerçek takıma göre gelir; item önerileri takımda o itemi taşıyacak uygun Pokémonu bulur; Ortak Seçim ve portal önerileri de aynı takım bağlamını kullanır; meta verisi oyuncunun elo seviyesine (en az Love Ball) göre ve az veride alt seviyeye düşerek seçilir. Tüm ağırlıklar tek bir ayarlanabilir nesnede toplanır.
- Engine: codex
- Model: deep
- Phase: D8
- Branch: `codex/d8-context` (base: `main`)
- Depends on: none (d8-eval paralel; `WEIGHTS`/`ctx.weights` sözleşmesi aşağıda)
- Role: implementer

## Ürün sahibinin istekleri (kelimesi kelimesine özet)

- "Team planner'da takım koyduysam öncelikle onu önersin, ama plana göre gitmiyorsam anlık takımıma göre de öneriler versin."
- "Ortak item seçme ve bölgesel seçme kısmında benim oynayışıma göre önermiyor."
- "Itemleri takacağım uygun Poké varsa önermiyor, bunlara da bakmalıyız."
- Varsayılan elo (şu an tüm oyuncular / LEVEL_BALL) yükseltilmeli.

## Sözleşmeler

- `PacAdvisor.WEIGHTS`: tüm puanlama sabitleri (şu anki `PKM_META_W`, `PKM_TEAM_W`, `ITEM_META_W`, `ITEM_TEAM_W`, sinerji +40/+20, kopya +35, dizilim bonusları, carousel/portal ağırlıkları, `UNKNOWN_META`, `META_STRONG` …) TEK bir donmuş nesnede, anlamlı adlarla. Her kullanım `const W = { ...WEIGHTS, ...ctx.weights }` üzerinden okunur. d8-eval bu nesneyi grid search ile `ctx.weights` vererek ayarlayacak; isimleri kısa bir yorumla açıkla.
- `PacAdvisor.buildContext({ data, meta, settings, snap })` → tüm arayüzlerin (panel, overlay, carousel, planner) kullanacağı ctx: `{ data, tierPokemons, tierItems, clusters, minGames, thresholds, regionsMeta, t?, names?, weights? }`. Arayüz dosyalarındaki elle ctx kurma kodlarını bununla değiştir.
- `PacAdvisor.teamContext(ctx, snap, plan)` → `{ units, planned, adherence: 0..1, planWeight: 0..1, synergies, families }` — bütün önericiler bunu kullanır.

## Tasks

1. **Elo seçimi:** `settings.tier` varsayılanı `"auto"`. auto: snapshot'taki oyuncu elosu (game-hook'a `elo: player.elo` ekle) → `EloRankThreshold` ile seviye (LEVEL_BALL 0, NET 1050, SAFARI 1100, LOVE 1150, PREMIER 1200, QUICK 1250, POKE 1300, SUPER 1350, ULTRA 1400, MASTER 1500, BEAST 1600); hedef = max(oyuncu seviyesi, LOVE_BALL); elo bilinmiyorsa LOVE_BALL. **Geri düşme:** bir Pokémon/item hedef seviyede `count < minGames` ise bir alt seviyeye, … LEVEL_BALL'a kadar düş. Birleştirilmiş `tierPokemons`/`tierItems` görünümünü (meta nesnesi + hedef + minGames anahtarıyla) önbelleğe al. Panel alt bilgisindeki seviye seçicisine "Otomatik (senin seviyen)" seçeneği (i18n EN+TR), elle seçim yine mümkün.
2. **Takım bağlamı:** `adherence` = plandaki ailelerden şu an tahta+yedekte olanların payı; `planWeight` = plan boşsa 0; tahtada < 3 birim varken plana güven (planWeight ≈ 0.8); sonra adherence ile ölçeklensin (plana uyuyorsa yüksek, sapmışsa düşük; tam sapmada ≤ 0.2). Hedef dizilim/aileler: plan ailelerinin `planWeight` ağırlığı + anlık takımın en iyi dizilim çekirdeğinin `1 - planWeight` ağırlığı.
3. **Bütün önericiler bağlamı kullansın:** dükkan ve Pokémon seçimleri (`boardAdvice`), item seçimleri, `rankCarousel`, `rankPortals`, `planRecommendations`, panel `analyze`. Gerekçeler plan mı anlık takım mı olduğunu söylesin (i18n anahtarı, EN+TR).
4. **Taşıyıcıya göre item:** `itemHolderFit(ctx, team, item)` → `{ holder, score, reasons }`. Sinyaller: item, adayın meta en çok 3 iteminde mi (güçlü); aday, `tierItems[item][2]` popüler taşıyıcılarında mı (güçlü); adayın taşıyıcı olma derecesi (yıldız, nadirlik, meta ortalama sırası, zaten item taşıyorsa); boş yuva (< 3 item); bileşense eldeki parçayla istenen bir iteme dönüşüyor mu. Taşıyıcısı olmayan item düşük puan alır. Item seçimleri, Ortak Seçim ve "hemen yap" bunu kullanır; gerekçe taşıyıcıyı adıyla söyler ("Garchomp için").
5. **Portallar:** bölge sinerjileri ve bölgesel Pokémonların takım bağlamına uyumu (anlık + plan ağırlıklı), bölge meta'sı (`regionsMeta`, `count >= minGames`).
6. Testler (`tests/advice.test.mjs`, `tests/carousel.test.mjs`): geri düşme; plan izleniyor/izlenmiyor geçişi; item doğru taşıyıcıya gider ve taşıyıcısız item düşük; Ortak Seçim planı yokken anlık takıma göre; portal takım sinerjisini yansıtır; `ctx.weights` bir ağırlığı değiştirince sonuç değişir. Mevcut testler geçmeli (gerekirse beklentileri gerekçesiyle güncelle). `tests/fixtures/meta.json` gerçek meta verisidir, testlerde kullanılabilir.

## Scope

- In: `extension/content/advisor.js`, `extension/page/game-hook.js` (sadece `elo`), ctx kuran yerler (`panel.js`, `overlay.js`, `carousel.js`, `planner.js`), `extension/background.js` (settings varsayılanı), `extension/i18n/en.json`, `tr.json`, `tests/advice.test.mjs`, `tests/carousel.test.mjs`, diğer testlerde gereken küçük beklenti güncellemeleri.
- Out: `scripts/`, `tests/fixtures/`, `tests/eval*.mjs`, `package.json` (d8-eval).

## Acceptance criteria

- [ ] `node --check` tüm JS; `node --test tests/*.test.mjs` geçer; i18n anahtar eşitliği korunur.
- [ ] `WEIGHTS`, `buildContext`, `teamContext`, `itemHolderFit` dışa açık ve dokümante.
- [ ] Gerçek meta fixture ile örnek: Garchomp/Rhyperior/Flygon tahtasında Muscle Band seçeneği "Garchomp için" gerekçesiyle, hiçbir taşıyıcının istemediği bir item düşük çıkar (test).

## Notes

Kod yorumları Türkçe. Git komutu çalıştırma. Performans: önceki commit'teki önbellekleri (familyIndex, chainCache) koru; yeni hesaplar da önbelleklensin (oyunda 1 sn'de bir çalışıyor).
