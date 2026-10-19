# Marka: isim ve logo

## İsim önerileri

Ortak kurallar: Türkçe, kısa, akılda kalır. "Pokémon" kelimesi isimde **geçmez** (ticari marka riski);
sadece açıklamada "Pokémon Auto Chess için" denir. "Koç" hem "koç hayvanı" (oyunun satranç + at/boynuz
imgesine yakın) hem "antrenör" demek; iki anlam da eklentinin işine uyuyor.

| # | İsim | Depo adı | Gerekçe |
|---|---|---|---|
| 1 | **Tahta Koçu** (uygulandı) | `tahta-kocu` | Oyunun tahtası + onu yöneten koç. Kısa, net, eklentinin işini (tahta önerileri) söylüyor. |
| 2 | **Koç Hamlesi** | `koc-hamlesi` | Satranç terimi "hamle" + koç. Önerilerin "sıradaki en iyi hamle" olduğunu vurgular. |
| 3 | **Koçbaşı** | `kocbasi` | Hem "koçun başı" (logodaki boynuzlar) hem de koçbaşı (kuşatma aleti). En kısa ve en akılda kalıcı; ama tek başına neyle ilgili olduğunu anlatmaz. |

Varsayılan olarak 1. öneri uygulandı (manifest `name` / `short_name`, popup, README). Kullanıcı başka
birini seçerse değişecek yerler: `extension/manifest.json` (`name`, `short_name`, `homepage_url`),
`extension/popup/popup.html` (başlık ve GitHub bağlantısı), `README.md`, bu dosya. Eski ad "PAC Koç"
panelde (`extension/content/panel.js`) ve konsol mesajlarında hâlâ geçiyor; bu iş kapsamı dışında,
panel işini yapan sonra güncelleyecek. `package.json` içindeki `pac-koc` paket adı da değişmedi.

Hesap: GitHub `badblli`. Depo adı: `tahta-kocu` (isimden türetilmiş kebab-case, ASCII).
`homepage_url`: `https://github.com/badblli/tahta-kocu`.

## Logo

![Tahta Koçu logosu](../extension/icons/icon-128.png)

Özgün çizim: 16x16 piksel ızgarası. Oyunun logosundan ya da varlıklarından hiçbir şey kopyalanmadı.

- **Piksel sanat**: oyunun piksel sanat diliyle uyumlu; kenarlar keskin, 16px'te de okunur.
- **Koyu lacivert zemin + açık mavi çerçeve**: oyunun lacivert/mor arayüzü. Alt iki satır **damalı tahta**.
- **Pokéball (kırmızı-beyaz top)**: oyunun konusu; ortadaki koyu bant ve düğme tek bakışta tanınır.
- **Sarı-turuncu boynuzlar**: "Koç"; oyunun vurgu rengi (sarı/turuncu) ve eklenti panelindeki altın rengi.

Kaynak: `scripts/build-icons.mjs` içindeki ızgara. `node scripts/build-icons.mjs` komutu hem
`extension/icons/logo.svg` dosyasını hem `icon-16/32/48/128.png` dosyalarını üretir (bağımlılık yok,
PNG kodlayıcı `node:zlib` ile). PNG boyutları ızgaranın tam katıdır (x1, x2, x3, x8), bu yüzden
bulanık kenar olmaz.

| 16 | 32 | 48 | 128 |
|---|---|---|---|
| ![16](../extension/icons/icon-16.png) | ![32](../extension/icons/icon-32.png) | ![48](../extension/icons/icon-48.png) | ![128](../extension/icons/icon-128.png) |
