# Tahta Koçu

<img src="extension/icons/icon-128.png" width="96" alt="Tahta Koçu logosu: boynuzlu pokéball">

[Pokémon Auto Chess](https://pokemon-auto-chess.com) için Türkçe çeviri ve oyun içi koç eklentisi (Chrome). Resmi bir ürün değildir; oyunun yapımcılarıyla bağlantısı yoktur.

**Yapan:** [badblli](https://github.com/badblli) · **Depo:** [github.com/badblli/tahta-kocu](https://github.com/badblli/tahta-kocu)

İsim ve logo seçimi için [docs/branding.md](docs/branding.md) dosyasına bak. Logo `node scripts/build-icons.mjs` ile yeniden üretilir.

Özellikler:

- **Türkçe çeviri:** Oyunun İngilizce dil dosyasını eklentideki Türkçe dosyayla değiştirir.
- **Oyun içi panel.** Dört sekmesi var:
  - **Oyunum:** Oyundayken tahtanı, yedeğini, dükkanını ve elindeki item parçalarını okuyup otomatik öneri yapar:
    - **Pokémon seçimi:** ek / eşsiz / efsanevi seçimlerde hangisinin takımına daha çok yarayacağı,
    - **Item seçimi:** karusel ya da ödül seçiminde hangi itemi alman gerektiği,
    - **Hemen yap:** elindeki parçalarla yapabileceğin itemler ve kime takacağın,
    - **Ekonomi:** sonraki tur geliri, faiz eşikleri, seviye atlama maliyeti, can azken uyarı, seviyene göre dükkan oranları,
    - **Sinerjiler:** her sinerjinin eşikleri, bir sonraki seviyeye kaç Pokémon kaldığı, yedekten ya da dükkandan hangisinin tamamlayacağı,
    - **Dükkan:** takımına yarayan Pokémonlar,
    - **Rakip:** sıradaki rakibinin aktif sinerjileri ve en çok itemli Pokémonları,
    - **Sana uyan dizilimler:** elindeki Pokémonlarla (evrimleri dahil) en çok örtüşen meta dizilimler,
    - **Havuz ve ihtimal** (popup'tan açılır, varsayılan kapalı): aradığın Pokémondan havuzda kaç kopya kaldığı ve yenileme başına dükkanda çıkma ihtimali,
    - **Bölgesel Pokémonlar:** bulunduğun bölgenin Pokémonlarından takımına uyanlar,
    - **Item önerisi:** her Pokémonun için önerilen itemler ve "hazır / 1 parça eksik" durumu,
    - **Oyun sonu özeti:** oyun bitince sıralaman, en çok benzeyen meta dizilim ve itemlerinin meta ile karşılaştırması.
  - **Pokémon:** Bir Pokémon'u ara; en çok kullanılan 3 itemi, tariflerini ve Türkçe açıklamalarını gör.
  - **Dizilimler:** Son oyunlardaki takım dizilimleri, ortalama sıralamaya göre dizili. Her dizilimde ana kadro, itemler ve örnek bir takım var.
  - **Itemler:** 10×10 tarif tablosu, item detayları ve taşıyanını en iyi bitiren itemler.

Veriler oyunun kendi meta raporundan gelir (`/meta-v2`, `/meta/pokemons`, `/meta/items`). Rapor son ~100.000 oyundan oluşur ve günde bir kez yenilenir.

## Kurulum (geliştirici modu)

1. Chrome'da `chrome://extensions` sayfasını aç.
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** düğmesine bas ve bu projedeki `extension` klasörünü seç.
4. pokemon-auto-chess.com'u aç. Oyunun ayarlarında dil **English** olmalı.
5. Sağ alttaki sarı oklu logoya ya da **Alt+P** kısayoluna basınca panel açılır.

Kodu değiştirdikten sonra `chrome://extensions` sayfasında eklentinin ⟳ düğmesine bas, ardından oyun sekmesini yenile.

## Nasıl çalışıyor?

| Dosya | Görevi |
|---|---|
| `extension/rules/tr_redirect.json` | `declarativeNetRequest` kuralı. `locales/en/translation.json` isteğini eklentideki `locales/tr/translation.json` dosyasına yönlendirir. |
| `extension/background.js` | Meta verisini 6 saatte bir kontrol eder. Rapor değiştiyse indirir, ~40 MB'ı ~1 MB'a küçültüp `chrome.storage`'a kaydeder. |
| `extension/page/game-hook.js` | Sayfanın kendi JS ortamında çalışır. Oyunun Redux store'unu ve Colyseus oyun durumunu yakalar, saniyede bir sadece **senin** takımının özetini panele yollar. Oyuna hiçbir mesaj göndermez. |
| `extension/content/advisor.js` | Öneri motoru: oyun özeti + meta verisinden dizilim, item, dükkan, karusel, sinerji, ekonomi, havuz, rakip ve bölge önerilerini hesaplar. Oyunun kurallarını (dükkan oranları, havuz boyutları, faiz) birebir kullanır. |
| `extension/content/panel.js` | Oyun sayfasına shadow DOM içinde paneli ekler. Panelde yazarken oyunun kısayolları tetiklenmez. |
| `extension/popup/` | Eklenti simgesine tıklayınca açılan ayarlar (çeviri / panel aç-kapa, veri durumu). |
| `extension/data/static.json` | Oyun kodundan çıkarılan item tarifleri, Pokémon portre numaraları, evrim aileleri, tipler, duolar ve dükkan kuralları (üretilen dosya). |
| `extension/locales/tr/translation.json` | Birleştirilmiş Türkçe dil dosyası (üretilen dosya). |
| `extension/icons/` | Logo (`logo.svg` ve PNG'ler `scripts/build-icons.mjs` ile üretilir). |

## Çeviri üzerinde çalışmak

Çeviriler `translations/tr.partial.json` dosyasında. Bu dosyanın yapısı oyunun `en/translation.json` dosyasıyla aynı, ama sadece çevrilmiş anahtarları içeriyor. Bir anahtarı buraya eklemezsen oyunda İngilizcesi görünür.

```bash
npm run build:tr
```

Bu komut güncel İngilizce dosyayı GitHub'dan çeker, Türkçe çevirileri üstüne yazar ve çevrilen metin oranını yazdırır. Bir çeviride oyunun kullandığı kalıplardan biri eksikse uyarı verir.

Kurallar:
- `SHIELD`, `ON_HIT`, `ATK`, `BURN` gibi BÜYÜK_HARFLİ kelimeler, `{{değişken}}` ve `[50,LK]` gibi kalıplar **aynen** kalmalı. Oyun bunları ikona ve renkli etikete çeviriyor.
- Bu kalıpların arkasına ek yapıştırma. `SHIELDı` yazarsan oyun kalıbı tanımaz; `SHIELD olarak` yaz.
- Item ve Pokémon isimleri bilerek İngilizce bırakıldı (rehberler ve topluluk bu isimleri kullanıyor).

Oyun güncellenip yeni item ya da Pokémon gelirse:

```bash
npm run build
```

> Uzun vadede en iyi yol, Türkçeyi doğrudan oyunun reposuna eklemek. Oyunun kendi çeviri sayfası var (https://pokemon-auto-chess.com/translations). Türkçe resmi olarak eklenirse herkes kullanabilir ve eklentiye gerek kalmaz.

## Verileri okurken dikkat

- Paneldeki "en çok kullanılan itemler", oyuncuların **en sık taktığı** itemler. Bunlar kanıtlanmış en iyi itemler değil; iyi bir başlangıç noktası.
- **Ort. sıra** 1 ile 8 arasında, 1 en iyisi. Elo seçimi "bu seviye ve üstü" oyunları gösterir. Yüksek elo seviyelerinde örnek az olabilir; az veri varsa panel ⚠ ile uyarır.
- "Taşıyanı en iyi bitiren itemler" listesi yanıltıcı olabilir: güçlü Pokémonlara takılan itemler doğal olarak daha iyi görünür.

## Oyunun kuralları

Oyunun kullanım koşulları "izinsiz otomasyon / araç" kullanımını yasaklıyor. Bu eklenti oyunda tıklamaz, hamle yapmaz ve oyuna mesaj göndermez. "Oyunum" sekmesi senin tarayıcında zaten bulunan oyun bilgisini okuyup öneri gösterir. Rakip özeti, oyunda tahtasına tıklayarak görebildiğin bilgiyi özetler. "Havuz ve ihtimal" ise tüm oyuncuların tahtalarını saydığı için en gri özellik; bu yüzden varsayılan olarak kapalı. Yine de yaygınlaştırmadan önce oyunun Discord'unda geliştiricilere sormak iyi olur.

## Lisans notu

Oyun GPL-3.0 lisanslı. Eklenti oyunun kodunu içermiyor. Sadece dil dosyasını ve item tarif verisini oyunun reposundan türetiyor; eklentiyi yayınlarsan GPL-3.0 kullanmak en sorunsuz yol.
