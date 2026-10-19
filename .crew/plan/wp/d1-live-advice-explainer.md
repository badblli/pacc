# d1-live-advice-explainer — Canlı durum ve kısa öneri gerekçesi

- Summary: Oyuncu panelde tahtanın okunup okunmadığını ve önerinin neden verildiğini görür.
- Engine: codex
- Phase: D1
- Branch: `codex/live-advice-explainer` (base: `main`)
- Depends on: d1-advice-engine; d1-team-aware-advice ile birlikte kullanıldığında takım gerekçeleri güçlenir.
- Role: implementer

## Goal

Canlı önerilerin dayandığı oyun verisini görünür kıl ve en önemli seçimin kısa gerekçesini göster.

## Scope

- In: `extension/page/game-hook.js`, `extension/content/panel.js`, `extension/content/panel.css`, `tests/advice.test.mjs`, bu WP.
- Out: öneri puanlaması, overlay, popup, çeviri ve veri dosyaları.

## Tasks

1. Oyun kancası her okuma denemesinde küçük bir durum sinyali yollar; değişmemiş oyun özetini tekrar yollamaz.
2. Panel bağlantı, okuma hatası, oyun dışı ve canlı tahta durumlarını ayırt eder; aktif Pokémon sayısını ve son okuma yaşını gösterir.
3. Okuma kesilirse eski özetten öneri göstermez.
4. Seçim ekranındaki en iyi seçenek veya uygun dükkan seçeneği için kısa Türkçe gerekçe gösterir.

## Acceptance criteria

- [ ] Canlı oyunda "Tahta okundu" durumu, aktif Pokémon sayısı ve okuma yaşı görünür.
- [ ] Oyun kancası gelmediğinde/okuma başarısız olduğunda eski öneriler canlıymış gibi gösterilmez.
- [ ] Gerekçe mevcut `boardAdvice` sonucuna dayanır ve takım/sinerji veya meta nedeni gösterir.
- [ ] Yeni oyun ağı veya model çağrısı eklenmez; oyuna hamle gönderilmez.
- [ ] AGENTS.md komutları geçer.
