# d2-branding — Oyunun temasına uyan isim ve logo

- Summary: Eklentiye Pokémon Auto Chess'in görsel diline (piksel sanat, damalı tahta, koyu lacivert + sarı/turuncu vurgular) uyan bir isim ve logo; GitHub hesabı (badblli) bilgisi.
- Engine: claude
- Model: standard
- Skill: frontend-design
- Phase: D2
- Branch: `claude/d2-branding` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Kullanıcı: "eklenti ismi ve logosu oyunun tema tarzıyla uyumlu olsun, GitHub hesabımı da iliştir (badblli)".

## Scope

- In: `extension/icons/` (logo.svg + 16/32/48/128 PNG), `extension/manifest.json` (sadece `name`, `short_name`, `description`, `author`, `homepage_url`),
  `extension/popup/popup.html` + `popup.css` (başlık/marka), `README.md` (başlık, logo, yazar/GitHub bölümü), yeni `docs/branding.md`.
- Out: panel.js/css (lider panel başlığını sonra günceller), advisor, overlay, game-hook, çeviri.

## Tasks

1. Oyunun stilini incele: pokemon-auto-chess.com giriş ekranı (koyu lacivert/mor damalı arka plan, kalın beyaz başlık, pokéball + satranç atı logosu,
   turuncu/sarı vurgu), oyunun repo'sundaki `app/public/src/assets/ui` (gerekirse raw.githubusercontent.com). Oyunun logosunu/varlıklarını KOPYALAMA;
   aynı dilde özgün bir logo çiz (ör. piksel sanat satranç taşı + pokéball yarısı + koç düdüğü/ok). 16px'te de okunur olmalı.
2. 3 isim önerisi üret (Türkçe, kısa, akılda kalır; "Pokémon" kelimesini isimde marka gibi KULLANMA — ticari marka riski; açıklamada "Pokémon Auto Chess için" denebilir).
   `docs/branding.md`: 3 isim + gerekçe + logo önizlemesi. Varsayılan olarak 1. öneriyi manifest/popup/README'ye uygula; lider kullanıcıya soracak.
3. `logo.svg` → PNG'ler (16/32/48/128). PNG üretimi için Node'da bağımlılık yoksa SVG'yi elle piksel ızgarası olarak yaz ve PNG'yi saf Node (zlib ile PNG kodlayıcı) ile üret; betiği `scripts/build-icons.mjs` olarak ekle.
4. README ve manifest: yazar `badblli`, `homepage_url: https://github.com/badblli/<repo-adı>` (repo adı: isimden türetilmiş kebab-case; `docs/branding.md`'de yaz).

## Acceptance criteria

- [ ] Logo oyunun görsel diline uyuyor, özgün, 16px'te okunur; PNG'ler betikle yeniden üretilebilir.
- [ ] 3 isim önerisi ve seçili isim manifest/popup/README'de tutarlı.
- [ ] Yazar/GitHub bilgisi eklendi.
- [ ] AGENTS.md komutları geçer (manifest geçerli JSON).
