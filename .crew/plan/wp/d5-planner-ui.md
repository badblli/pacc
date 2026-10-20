# d5-planner-ui — Team Planner'a gömülü koç + oyun içi plan takibi

- Summary: Oyunun Takım Planlayıcısı açılınca içine PACC'in "Önerilen" paneli, "Meta dizilimden başla" düğmesi ve dizilim seçme penceresi eklenir; oyun sırasında sol üstte küçük bir plan takip kartı görünür. Sağ alttaki panel ikinci planda kalır.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D5
- Branch: `codex/d5-planner-ui` (base: `main`)
- Depends on: d5-planner-bridge (mesaj protokolü), d5-planner-advice (PacAdvisor API) — paralel çalışır; iki sözleşme aşağıda, onları aynen kullan, eksikse zarif boş durum göster.
- Role: implementer

## Goal

Use your frontend-design skill. Onaylı tasarım (ürün sahibi onayladı): https://claude.ai/artifact/Cwr1QxjLrd6TtbvUk9uA6p (3 ekran: 1 Team Planner + Önerilen, 2 Meta dizilimden başla, 3 Oyun içi plan takibi). Görsel dil: oyunun koyu lacivert panelleri, 2px çerçeve, 10–14px köşe, altın vurgu `#f6c445`, yeşil `#5fd68a`, "Planda" mavisi `#6fb7ff`, Jost benzeri sans. Dokunma hedefleri ≥44px, kontrast ≥4.5:1.

## Sözleşmeler

- Köprü (d5-planner-bridge): `window` mesajları — gelen `{type:"pac-yardimci:planner", planner:{open, board, rects:{modal, actions, picker, board}|null}}`; giden `{type:"pac-yardimci:planner-set", board, requestId}` → yanıt `{type:"pac-yardimci:planner-set-result", requestId, ok, via:"react"|"storage", note?:"reopen", error?}`. `pac-yardimci:hello` yollayınca son durum tekrar gelir.
- Öneri motoru (d5-planner-advice): `PacAdvisor.planFit(ctx, plan)`, `PacAdvisor.planRecommendations(ctx, plan, {limit})`, `PacAdvisor.planItems(ctx, plan)`, `PacAdvisor.compToPlan(ctx, cluster, {keepPlan})` — şekiller d5-planner-advice.md'de. `ctx`'i panel.js'in mevcut `advisorCtx()` ile aynı şekilde kur (meta storage'dan, static.json, i18n `t`).

## Tasks

1. Yeni `extension/content/planner.js` + `planner.css` (manifest'te advisor/i18n'den sonra, panel/overlay ile aynı content script grubunda; css web_accessible_resources'a). Kendi shadow DOM host'u; oyunun React DOM'una düğüm EKLEME — konumu köprüden gelen `rects` ile `position:fixed` hizala.
2. Planlayıcı açıkken (`planner.open`):
   - **Önerilen paneli**: Pokémon seçici alanının (`rects.picker`) üstüne hizalı, açılıp kapanan bir "★ Önerilen" sekme düğmesi (seçicinin sekme çubuğunun soluna); açıkken `rects.picker` alanını kaplayan panel: `planRecommendations` kartları (portre, ad, nadirlik, %uyum, gerekçe), karta tıklayınca/"Ekle" ile planın ilk boş karesine ekleyip `planner-set` yolla.
   - **Koç özeti**: `rects.modal` sağ üst köşesine hizalı küçük kart (açılır): en iyi dizilime %uyum, eksikler (Ekle düğmeli), item planı (`planItems`).
   - **"Meta dizilimden başla"** düğmesi: `rects.actions` alanının soluna hizalı; tıklayınca dizilim seçme penceresi (tasarım ekran 2): sinerji filtreleri, dizilim kartları (ort. sıra, 1.lik %, oyun, çekirdek birimler; planda olanlar yeşil halkalı), sağda önizleme + "Plana yükle (mevcut planın yerine)" ve "Sadece eksikleri ekle" (`compToPlan` keepPlan).
   - `planner-set-result.note === "reopen"` ise kısa bir bilgi göster ("Planlayıcıyı kapatıp açınca görünür").
3. Oyun içinde (`/game`, planlayıcı kapalı) ve plan boş değilse **plan takip kartı** (tasarım ekran 3): sol üst, küçültülebilir; plan adı (en iyi dizilim başlığı), çekirdek birim ilerlemesi (oyuncunun tahta+yedeğindeki aileler / plandaki aileler — mevcut `pac-yardimci:game` snapshot'ından), sıradaki 3 adım (dükkanda plandaki birim varsa "X'i al", yükseltme için kopya, eldeki parçalarla plandaki item), sinerji ilerleme çipleri. Dükkanda oyunun kendi "planned" işareti zaten var; tekrar çizme.
4. Sağ alttaki panel ikinci planda: launcher daha küçük ve yarı saydam (hover'da tam), oyun içi otomatik açılma yok; mevcut özellikler aynen kalır.
5. Popup'a "Takım Planlayıcı koçu" aç/kapa ayarı (`settings.planner`, varsayılan açık) ve i18n anahtarları (EN + TR, `extension/i18n/en.json` + `tr.json`, iki katalog aynı anahtar setinde — mevcut i18n testi bunu denetler).

## Scope

- In: yeni `extension/content/planner.js`, `extension/content/planner.css`, `extension/manifest.json`, `extension/i18n/en.json`, `extension/i18n/tr.json`, `extension/popup/*`, `extension/content/panel.js` + `panel.css` (sadece launcher'ı ikinci plana alma), `tests/` (harness: `tests/planner-harness.html`, mevcut panel-harness gibi; sahte `pac-yardimci:planner` mesajı ve sahte PacAdvisor ile).
- Out: `extension/page/game-hook.js`, `extension/content/advisor.js` (diğer WP'ler).

## Acceptance criteria

- [ ] `node --check` tüm JS; `node --test tests/*.test.mjs` geçer (i18n anahtar eşitliği dahil); manifest geçerli JSON.
- [ ] Harness'ta: planlayıcı açık mesajı gelince Önerilen düğmesi seçici alanına, Meta dizilim düğmesi actions alanına hizalanır; dizilim penceresi açılır ve "Plana yükle" doğru `planner-set` mesajı yollar.
- [ ] Plan takip kartı sadece oyun içinde ve plan boş değilken görünür; küçültülebilir.
- [ ] Oyunun DOM'una düğüm eklenmez (sadece kendi shadow host'u `document.documentElement`'e).

## Notes

Kod yorumları Türkçe, arayüz metinleri i18n'den. Git komutu çalıştırma; lider commit'ler.
