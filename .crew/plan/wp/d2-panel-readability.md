# d2-panel-readability — Panel okunabilirliği ve Pokémon arama hatası

- Summary: Sağ alttaki paneli daha okunur yapmak ve Pokémon aramasının sonuç vermemesini düzeltmek.
- Engine: claude
- Model: standard
- Skill: frontend-design
- Phase: D2
- Branch: `claude/d2-panel-readability` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Kullanıcı: "sağ alttaki eklenti panosu daha okunabilir olmalı, pokemonları aratınca çıkmıyor".

## Scope

- In: `extension/content/panel.js`, `extension/content/panel.css`, yeni `tests/panel-harness.html`.
- Out: advisor.js, overlay.*, game-hook.js, manifest, icons, popup, çeviri.

## Tasks

1. Arama hatasını bul ve düzelt (tahmin etme, doğrula). Olası nedenler: `viewPokemon` sadece seçili elo seviyesinde meta kaydı olanları arıyor
   (`tierPokemons()`); Türkçe/İngilizce ad ve anahtar eşleşmesi ("chari", "Charizard", "CHARIZARD"); aile üyeleri ("charmander" → aile);
   shadow DOM'da input olayı; `main.innerHTML` yeniden yazılınca odak kaybı; meta yokken boş liste. Meta kaydı olmayan Pokémonlar da
   (static.json `pokemons`) "meta verisi yok" notuyla listelensin; aile adıyla aramak tüm aileyi getirsin.
2. Okunabilirlik: temel yazı 14px, satır aralığı 1.45, kontrast WCAG AA, bölümler arası boşluk, kart içi hiyerarşi (ad büyük, istatistik
   satırı okunur), portre/ikon biraz büyük, panel genişliği 440px (küçük ekranda max 100vw-32px), "Oyunum" sekmesinde acil bölümler
   (seçim / item seçimi / hemen yap) en üstte ve öne çıkmış.
3. Panel köşeden büyütülebilsin; konum/boyut `chrome.storage.local` `panelBox` ile hatırlansın.
4. `tests/panel-harness.html`: chrome stub, `../extension/data/static.json` + sahte meta; arama senaryosu dahil.

## Acceptance criteria

- [ ] Harness'te "chari", "Charmander", "GYARADOS" aramaları sonuç verir; meta kaydı olmayan Pokémon notla görünür.
- [ ] Yazı/kontrast/boşluk iyileşmiş; panel yeniden boyutlanır ve konumu hatırlanır.
- [ ] Panel overlay'in üstünde kalır (z-index); panelde yazarken oyun kısayolları tetiklenmez.
- [ ] AGENTS.md komutları geçer.
