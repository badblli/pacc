# Marka: isim ve logo

## Seçilen isim: PACC

Kullanıcının kararı: eklentinin adı **PACC** ("Poké Auto Chess Coach" kısaltması). Eklenti artık İngilizce
ve Türkçe arayüzle global kullanılacağı için Türkçe bir ad yerine iki dilde de aynı kalan kısa bir ad seçildi.

| Yer | İngilizce | Türkçe |
|---|---|---|
| Kısa ad (`short_name`, popup, panel başlığı, `action.default_title`) | PACC | PACC |
| Uzun ad (`name`) | PACC — Auto Chess Coach | PACC — Auto Chess Koçu |
| Açıklama | "… for Pokémon Auto Chess …" | "Pokémon Auto Chess için …" |

Kural aynı kaldı: "Pokémon" kelimesi **isimde geçmez** (ticari marka riski); sadece açıklamada
"for Pokémon Auto Chess" / "Pokémon Auto Chess için" denir.

Ad şu yerlerde: `extension/_locales/{en,tr}/messages.json` (`extName`, `extShortName`, `actionTitle`),
`extension/i18n/{en,tr}.json` (`app.name`: panel başlığı, popup, overlay bildirimi), konsol öneki `[PACC]`,
`README.md`, `README.tr.md`, bu dosya. `package.json` paket adı: `pacc`.

Hesap: GitHub `badblli`. Depo: `pacc`. `homepage_url`: `https://github.com/badblli/pacc`.

## Tarihçe: ilk isim önerileri (Türkçe)

İlk turda kurallar: Türkçe, kısa, akılda kalır. "Koç" hem "koç hayvanı" (oyunun satranç + at/boynuz
imgesine yakın) hem "antrenör" demek. 1. öneri bir süre uygulandı (eski panel adı "PAC Koç" idi), sonra PACC'ye geçildi.

| # | İsim | Depo adı | Gerekçe |
|---|---|---|---|
| 1 | **Tahta Koçu** (PACC'den önce uygulanmıştı) | `tahta-kocu` | Oyunun tahtası + onu yöneten koç. Kısa, net, eklentinin işini (tahta önerileri) söylüyor. |
| 2 | **Koç Hamlesi** | `koc-hamlesi` | Satranç terimi "hamle" + koç. Önerilerin "sıradaki en iyi hamle" olduğunu vurgular. |
| 3 | **Koçbaşı** | `kocbasi` | Hem "koçun başı" (logodaki boynuzlar) hem de koçbaşı (kuşatma aleti). En kısa ve en akılda kalıcı; ama tek başına neyle ilgili olduğunu anlatmaz. |

## Logo

![PACC logosu](../extension/icons/icon-128.png)

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
