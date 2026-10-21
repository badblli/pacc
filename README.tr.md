# PACC — Auto Chess Koçu

<img src="extension/icons/icon-128.png" width="96" alt="PACC logosu: boynuzlu pokéball">

[English](README.md) · **Türkçe**

PACC (Poké Auto Chess Coach), [Pokémon Auto Chess](https://pokemon-auto-chess.com) için bir Chrome eklentisi: oyun içi koç paneli, tahta üstü öneriler ve isteğe bağlı Türkçe oyun çevirisi. Resmi bir ürün değildir; oyunun yapımcılarıyla bağlantısı yoktur.

**Yapan:** [badblli](https://github.com/badblli) · **Depo:** [github.com/badblli/pacc](https://github.com/badblli/pacc)

İsim ve logo seçimi için [docs/branding.md](docs/branding.md) dosyasına bak. Logo `node scripts/build-icons.mjs` ile yeniden üretilir.

![Gerçek oyunda başlangıç seçimi: PACC, Squirtle'ı "✓ Önerilen · %14", diğerlerini "İyi seçenek" olarak işaretliyor; sağdaki PACC paneli öneriyi, seçim sırasını ve ekonomiyi, sol üstteki kart da planı gösteriyor](docs/screenshots/starter-pick-tr.jpg)

*Gerçek oyunda başlangıç seçimi: her seçenekte uyum yüzdeli rozet var. Sağdaki panel (Oyunum sekmesi) öneriyi, planına göre seçim sırasını ve ekonomiyi gösteriyor; sol üstte plan takip kartı.*

### Ekran görüntüleri

![Oyunun Takım Planlayıcısı'nda PACC yan çekmecesi Meta dizilimler sekmesinde: sinerji filtresi ve ortalama sıra, oyun sayısıyla meta dizilimler](docs/screenshots/planner-drawer-tr.jpg)

*Takım Planlayıcı koçu: PACC çekmecesi **Meta dizilimler** sekmesinde. Sinerjiye göre süz, ortalama sırası ve oyun sayısıyla bir dizilim seç, planlayıcıya yükle.*

![Bölge portalı seçiminde PACC kartı: "Bölge seçimi — önerilen sıra", portallar planına göre sıralı; solda canlı plan takip kartı](docs/screenshots/region-pick-tr.jpg)

*Bölge portalı seçimi: PACC portalları planına göre sıralıyor (sinerjiler, örnek Pokémonlar, ortalama sıra); solda canlı plan takip kartı.*

## Özellikler

- **İngilizce ve Türkçe arayüz.** Dil tarayıcı dilinden seçilir (tarayıcı dili `tr` ile başlıyorsa Türkçe, değilse İngilizce). Popup'tan istediğin an değiştirebilirsin (Otomatik / English / Türkçe); panel ve tahta üstü işaretler hemen yeni dilde çizilir. İngilizcede Pokémon, item ve sinerji adları oyunun kendi İngilizce adlarıdır.
- **Tahta üstü öneriler.** Seçim pencerelerinde (başlangıç, ek / eşsiz / efsanevi Pokémon, item karuseli ve ödüller) ve dükkanda önerilen seçenek yeşil, kaçınılacak seçenek kırmızı çerçeve ve uyum yüzdesiyle işaretlenir. Çerçevenin üstüne gelince gerekçeyi okursun. Item birleştirme ipuçları tahtadaki iki parçayı ve sürükleyeceğin Pokémonu işaretler. **Alt+I** birleştirme ipuçlarını, **Alt+O** tüm işaretleri açıp kapatır.
- **Takım Planlayıcı koçu.** Oyunun kendi Takım Planlayıcısı'nı açınca (**T** ya da lobideki planlayıcı simgesi) PACC başlığa bir **PACC** düğmesi ekler; düğme üç sekmeli bir yan çekmece açar: **Önerilen** (planına uyan Pokémonlar, uyum yüzdesi ve gerekçesiyle), **Meta dizilimler** (meta raporundan bir dizilim seçip planlayıcıya yükle — oyun da dükkanında o Pokémonları kendi işaretiyle gösterir) ve **Planım** (planının en iyi meta dizilime ne kadar yakın olduğu, eksik çekirdek birimler, item planı). Oyun sırasında küçük bir plan takip kartı ilerlemeni ve sıradaki adımları gösterir.
- **Ortak Seçim ve bölge portalları.** Ortak Seçim (item karuseli) ve bölge portalı sahnelerinde bir kart, seçeneklerin önerilen sırasını kısa gerekçesiyle gösterir.
- **Oyun içi panel** (sağ alttaki logo düğmesi ya da **Alt+P**). Dört sekmesi var:
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
  - **Pokémon:** Bir Pokémon'u ara (ör. "chari" de yeter); en çok kullanılan 3 itemi, tariflerini, açıklamalarını ve evrim zincirini gör.
  - **Dizilimler:** Son oyunlardaki takım dizilimleri, ortalama sıralamaya göre dizili. Her dizilimde ana kadro, itemler ve örnek bir takım var.
  - **Itemler:** 10×10 tarif tablosu, item detayları ve taşıyanını en iyi bitiren itemler.
- **Türkçe oyun çevirisi** (isteğe bağlı): Oyunun İngilizce dil dosyasını eklentideki Türkçe dosyayla değiştirir. Varsayılan olarak yalnız arayüz dili Türkçeyse açıktır.

Veriler oyunun kendi meta raporundan gelir (`/meta-v2`, `/meta/pokemons`, `/meta/items`). Rapor son ~100.000 oyundan oluşur ve günde bir kez yenilenir.

## Güvenli mi?

Eklentilere karşı dikkatli olmak doğru. PACC'ın neyi yapıp neyi yapamadığı ve bunu nasıl kendin kontrol edeceğin:

- **Sadece tek sitede çalışır.** PACC'ın tek site izni `https://pokemon-auto-chess.com/*`. Başka hiçbir sekmeyi ya da siteyi göremez.
- **Sadece tek sunucuyla konuşur.** Koddaki tek adres `https://pokemon-auto-chess.com`; oyunun herkese açık meta raporu için kullanılır. Analiz, takip, kendi sunucusu yok; senin hakkında hiçbir şey dışarı gönderilmez. Bkz. [PRIVACY.md](PRIVACY.md).
- **Senin yerine oynamaz.** Hiçbir şeye tıklamaz, sürüklemez, satın almaz, oyuna bir şey göndermez. Sadece sayfanın üstüne rozet ve panel çizer. Değiştirdiği tek şey kendi Takım Planlayıcın, o da yalnızca **Plana yükle**'ye bastığında (planlayıcı senin tarayıcında saklanır).
- **Gizli kod yok.** Her şey bu repoda (GPL-3.0). Uzaktan yüklenen ya da sıkıştırılmış kod yok; sürüm zip'i `extension/` klasöründen `npm run pack` ile üretilir.
- **Az izin.** `storage` (ayarlar ve meta önbelleği), `alarms` (meta raporunu 6 saatte bir kontrol), `declarativeNetRequest` (sadece isteğe bağlı Türkçe çeviri için).

**Kendin kontrol et:** `chrome://extensions` sayfasında PACC → *Ayrıntılar* bölümünde izinleri görürsün; ya da oynarken Geliştirici Araçları → *Ağ (Network)* sekmesini aç, sadece pokemon-auto-chess.com isteklerini görürsün.

## Kurulum (2 dakika)

PACC Chrome, Edge, Brave ve Opera'da çalışır.

1. [Son sürümden](https://github.com/badblli/pacc/releases/latest) `PACC-vX.Y.Z.zip` dosyasını **indir** ve **zip'ten çıkar** (sağ tık → *Tümünü ayıkla*).
2. `chrome://extensions` sayfasını aç (Edge: `edge://extensions`).
3. Sağ üstten **Geliştirici modu**nu aç.
4. Çıkardığın **klasörü sayfaya sürükle** ya da **Paketlenmemiş öğe yükle** düğmesiyle seç.
5. [pokemon-auto-chess.com](https://pokemon-auto-chess.com)'u açıp bir oyuna gir. Öneriler seçim pencerelerinde ve dükkanda görünür; panel için **Alt+P** (ya da sağ alttaki logo).

Çıkardığın klasörü silme: Chrome eklentiyi oradan yükler. Güncellemek için yeni zip'i indir, klasörün içeriğini değiştir ve PACC kartındaki ⟳ düğmesine bas.

> Arayüz tarayıcı diline göre açılır (Türkçe ya da İngilizce); araç çubuğundaki PACC simgesinden değiştirebilirsin. Türkçe oyun çevirisi için oyunun kendi dil ayarı **English** olmalı.

### Kaynaktan (geliştiriciler)

Repoyu klonla ve `extension` klasörünü **Paketlenmemiş öğe yükle** ile seç. Kodu değiştirince eklenti kartındaki ⟳ düğmesine bas ve oyun sekmesini yenile. `npm run pack` sürüm zip'ini üretir.

## Nasıl çalışıyor?

| Dosya | Görevi |
|---|---|
| `extension/manifest.json`, `extension/_locales/` | Manifest; ad ve açıklama dile göre (`default_locale: "en"`). |
| `extension/rules/tr_redirect.json` | `declarativeNetRequest` kuralı. `locales/en/translation.json` isteğini eklentideki `locales/tr/translation.json` dosyasına yönlendirir. |
| `extension/background.js` | Meta verisini 6 saatte bir kontrol eder. Rapor değiştiyse indirir, ~40 MB'ı ~1 MB'a küçültüp `chrome.storage`'a kaydeder. Kurulumda çeviri varsayılanını arayüz diline göre ayarlar. |
| `extension/page/game-hook.js` | Sayfanın kendi JS ortamında çalışır. Oyunun Redux store'unu ve Colyseus oyun durumunu yakalar, saniyede bir sadece **senin** takımının özetini yollar. Oyuna hiçbir mesaj göndermez. |
| `extension/content/i18n.js` | Arayüz dili yardımcısı (`PacI18n.t`); diğer content script'lerden önce ve popup'ta yüklenir. |
| `extension/i18n/en.json`, `extension/i18n/tr.json` | Arayüz metinleri (panel, tahta üstü işaretler, popup, öneri gerekçeleri). İki katalogda anahtarlar aynı olmalı. |
| `extension/i18n/game.en.json` | İngilizce arayüz için oyunun İngilizce adları ve item açıklamaları (üretilen dosya, aşağıya bak). |
| `extension/content/advisor.js` | Öneri motoru: oyun özeti + meta verisinden dizilim, item, dükkan, karusel, sinerji, ekonomi, havuz, rakip ve bölge önerilerini hesaplar. Oyunun kurallarını (dükkan oranları, havuz boyutları, faiz) birebir kullanır. |
| `extension/content/overlay.js` | Tahta üstü çerçeveleri, rozetleri ve birleştirme ipuçlarını ayrı bir shadow DOM katmanında çizer. Hiçbir şeye tıklamaz, sürüklemez. |
| `extension/content/panel.js` | Oyun sayfasına shadow DOM içinde paneli ekler. Panelde yazarken oyunun kısayolları tetiklenmez. |
| `extension/popup/` | Ayarlar (dil, çeviri, panel, tahta üstü işaretler, havuz takibi, veri durumu). |
| `extension/data/static.json` | Oyun kodundan çıkarılan item tarifleri, Pokémon portre numaraları, evrim aileleri, tipler, duolar ve dükkan kuralları (üretilen dosya). |
| `extension/locales/tr/translation.json` | Birleştirilmiş Türkçe dil dosyası (üretilen dosya). |
| `extension/icons/` | Logo (`logo.svg` ve PNG'ler `scripts/build-icons.mjs` ile üretilir). |

## Geliştirme

```bash
node tests/advice.test.mjs   # öneri motoru (Türkçe katalog, eksik anahtar hata)
node tests/i18n.test.mjs     # kataloglar, anahtar kullanımı, İngilizce/Türkçe gerekçeler, sabit metin taraması
```

Tarayıcı deneme tahtaları (eklenti gerekmez): `tests/panel-harness.html` ve `tests/overlay-harness.html`; depo kökünden yerel bir sunucuyla aç. İkisi de `?lang=en|tr` alır; panel tahtası `?autotest=1` ile kontrolleri çalıştırır.

Arayüze metin eklerken: anahtarı **hem** `extension/i18n/en.json` **hem** `extension/i18n/tr.json` dosyasına ekle, kodda `t("anahtar", { değişken })` (düz metin) ya da `h("anahtar", { değişken })` (HTML'e güvenli) kullan. Değişkenler `{{ad}}`; çoğul `anahtar_one` / `anahtar_other` ve sayısal `count` ile.

Oyun güncellenince İngilizce oyun adlarını yeniden üretmek için:

```bash
node scripts/build-i18n-game-en.mjs [en/translation.json yolu]
```

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

Oyunun kullanım koşulları "izinsiz otomasyon / araç" kullanımını yasaklıyor. Bu eklenti oyunda tıklamaz, hamle yapmaz ve oyuna mesaj göndermez. "Oyunum" sekmesi ve tahta üstü işaretler, senin tarayıcında zaten bulunan oyun bilgisini okuyup öneri gösterir. Rakip özeti, oyunda tahtasına tıklayarak görebildiğin bilgiyi özetler. "Havuz ve ihtimal" ise tüm oyuncuların tahtalarını saydığı için en gri özellik; bu yüzden varsayılan olarak kapalı. Yine de yaygınlaştırmadan önce oyunun Discord'unda geliştiricilere sormak iyi olur.

## Lisans

Oyun GPL-3.0 lisanslı. Eklenti oyunun kodunu içermiyor. Sadece dil dosyasını ve item tarif verisini oyunun reposundan türetiyor; eklentiyi yayınlarsan GPL-3.0 kullanmak en sorunsuz yol.

## Bir maçı kaydedip geliştiricilere göndermek

Oynamadan önce eklenti popup'ından **Maçı kaydet (geliştirici)** seçeneğini açın. Kayıt varsayılan olarak kapalıdır. Maçtan sonra kapatın ve **Kaydı indir (n durum)** düğmesine basın; oluşan `pacc-game-YYYYMMDD-HHMM.json` dosyasını geliştiricilere gönderin. **Kaydı sil** yerel kaydı temizler; ayrı bir maça başlamadan önce önceki kaydı silin.

Oyuncu adları ve kimlikleri saklanmadan önce anonimleştirilir, avatar alanları kaldırılır. Yaklaşık 8 MB sınırı dolunca en eski olaylar atılır; meta veritabanı kayda dahil değildir. Paylaşmadan önce JSON'u gözden geçirin. Kaydı kapatmak mevcut kaydı silmez; daha sonra indirebilirsiniz.

Geliştiriciler: kayıtları `tests/fixtures/games/` altına koyup `node --test tests/replay.test.mjs` çalıştırabilir. `sample-synthetic.json` elle hazırlanmış örnektir, gerçek maç değildir. Görsel tekrar için depo kökünde `python -m http.server 8123` çalıştırıp `http://localhost:8123/tests/replay-harness.html?file=fixtures/games/sample-synthetic.json` adresini açın veya yerel dosya seçin. Zaman çubuğuyla olaylarda gezinin; overlay koordinatları için kayıttaki pencere boyutunu kullanın. Tekrar oynatma depodaki meta fixture'ını ve güncel varsayılan ayarları kullandığından geçmiş önerilerden farklı sonuç verebilir.
