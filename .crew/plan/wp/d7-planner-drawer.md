# d7-planner-drawer — Planlayıcı koçu: tek PACC düğmesi + yan çekmece

- Summary: Takım Planlayıcı'nın başlığındaki üç ayrı kontrol yerine tek bir "PACC" düğmesi gelir. Düğme planlayıcının sağından açılan bir çekmeceyi açar; çekmecede Önerilen, Meta dizilimler ve Planım sekmeleri var. Ürün sahibi mevcut halin sıkışık ve üst üste binmiş göründüğünü söyledi.
- Engine: codex
- Model: standard
- Skill: frontend-design
- Phase: D7
- Branch: `codex/d7-planner-drawer` (base: `main`)
- Depends on: none
- Role: implementer

## Goal

Use your frontend-design skill. Oyunun planlayıcı penceresi içinde, oyunun kendi arayüzüyle çakışmayan, ferah bir koç çekmecesi.

## Gerçek oyunda öğrenilenler (UYULMASI ŞART)

- Oyun planlayıcıyı `dialog.showModal()` ile açar. Dialog dışındaki her şey **inert**: tıklanmaz. Host planlayıcı açıkken dialog'un İÇİNE taşınır (mevcut `mountHost` — koru). Pointer olayları shadow root'ta durdurulur (koru). Yoksa oyun "dışarı tıklandı" sanıp kapanır.
- Köprü `rects`: `{modal, header, actions, picker, board}`. `header` = `dialog > header`. Oyunun başlığında yazı ortalı, kapatma düğmesi (`.close-btn`) sağda float.
- Planlayıcıda y=3 ön sıra (rakibe en yakın). Pokémon seçici `#pokemon-picker`, item seçici `#item-picker` (react-tabs sınıfı yok).
- Oyunun "Kaydet / Yükle / Sıfırla / Anlık görüntü" düğmeleri `.actions` içinde, sağa yaslı. Onları ÖRTME.

## Tasks

1. `extension/content/planner.js` + `planner.css`: başlıkta TEK düğme: logo (`icons/icon-48.png`, web_accessible) + "PACC" + küçük uyum rozeti (ör. "%67"). Kapatma düğmesinin soluna, aralarında ≥16px boşluk; dikeyde başlığa ortalı; ≥44px hedef.
2. Düğme sağdan açılan **çekmeceyi** aç/kapa yapar:
   - Konum: `rects.modal`'ın sağ kenarına yaslı, başlığın hemen altından modalın altına; genişlik `min(440px, modal.w * 0.42)`; kendi içinde kaydırılır. Oyunun sağ sütununu (seçili birim + item seçici) örter, tahtayı ve sol sinerji sütununu açık bırakır. Açılışta kısa bir kayma animasyonu (`prefers-reduced-motion`'a saygı).
   - Başlığında sekmeler: **Önerilen** (mevcut `planRecommendations` kartları, "Ekle"), **Meta dizilimler** (mevcut chooser'ın içeriği: sinerji filtresi, dizilim listesi; seçili dizilimin mini tahta önizlemesi y=3 üstte; "Plana yükle (mevcut planın yerine)" ve "Sadece eksikleri ekle"), **Planım** (en iyi dizilime %uyum, eksik çekirdek birimler + "Ekle", item planı `planItems`). Sağ üstte kapat (×) düğmesi.
   - Tam ekran perde (veil) yok; çekmece dialog'un içinde kalır.
   - Escape çekmeceyi kapatır (planlayıcıyı değil); odak çekmece içinde döner, kapanınca PACC düğmesine döner.
3. Eski `.toolbar`, `.recommended-tab`, `.meta-action`, `.coach` ve `.veil/.chooser` yerleşimlerini kaldır; aynı işlevler çekmecede. Bildirimler (`notice`) çekmecenin altında.
4. Oyun içi plan takip kartı (planlayıcı kapalıyken) olduğu gibi kalır.
5. i18n EN + TR anahtarları (aynı set), gerekiyorsa yenileri; kullanılmayanları sil.
6. `tests/planner-harness.html`: içinde GERÇEK bir `<dialog class="modal my-container team-builder-modal">` olsun, `showModal()` ile açılsın, oyunun başlığı + `.close-btn` + `.actions` (4 düğme sağa yaslı) + `#pokemon-picker` + `#item-picker` + `#team-editor` gerçek boyutlarda (modal ~1400×75vh) çizilsin; köprü mesajı bu öğelerin gerçek `getBoundingClientRect`'inden üretilsin. Ayrıca dialog'a oyunun "dışarı tıklanınca kapan" mousedown işleyicisini ekle.
7. `tests/planner-ui.test.mjs`: yeni yerleşime göre güncelle (tek düğme konumu: header içinde, close-btn'nin solunda; çekmece modal'ın sağ kenarında; sekme geçişleri; Plana yükle mesajı).

## Acceptance criteria

- [ ] `node --check` tüm JS, manifest JSON, `node --test tests/*.test.mjs` geçer.
- [ ] Harness'ta (gerçek dialog açıkken): PACC düğmesi ve çekmecedeki her düğme `document.elementFromPoint` ile bizim öğemizi döndürür (inert değil); tıklamalar planlayıcıyı kapatmaz; PACC düğmesi `.close-btn` ve `.actions` düğmeleriyle kesişmez (dikdörtgen kesişim testi harness'ta yazdırılır).
- [ ] 1280×720 ve 1920×1080 pencerede çakışma yok (harness'ta iki boyut için kesişim raporu).
- [ ] Oyunun DOM'una sadece host eklenir (dialog içine taşıma hariç düğüm eklenmez).

## Notes

Kod yorumları Türkçe, metinler i18n'den. Git komutu çalıştırma; lider commit'ler. Görsel doğrulama için tarayıcın açılamazsa harness'taki kesişim raporunu Node/JSDOM olmadan da hesaplanabilir şekilde yaz; lider tarayıcıda açacak.
