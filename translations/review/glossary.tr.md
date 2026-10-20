# Pokémon Auto Chess — Türkçe Terim Sözlüğü (Glossary)

Bu belge, Pokémon Auto Chess (PACC) Türkçe yerelleştirmesinde geçen temel terimleri, mevcut çeviride kullanılan Türkçe karşılıkları, birden fazla karşılık kullanılan tutarsızlıkları ve önerilen standart terimleri listeler.

---

## 1. Temel İstatistikler (Stats)

Oyun içi açıklamalarda statlar genellikle oyun motorunun ikona dönüştürdüğü BÜYÜK_HARF kalıplar (ATK, DEF, SHIELD vb.) olarak yer alır. Arayüzde (UI / tooltip) ise Türkçe metinler kullanılır.

| İngilizce Terim | Kullanılan Türkçe Karşılık(lar) | Önerilen Tek Karşılık | Durum / Tutarsızlık | Açıklama / Bağlam |
| :--- | :--- | :--- | :--- | :--- |
| **ATK** (Attack) | Saldırı, ATK | **Saldırı** (UI) / **ATK** (Açıklama kalıbı) | Tutarlı | Fiziksel saldırı gücü. Kalıplarda `ATK` korunur. |
| **DEF** (Defense) | Savunma, DEF | **Savunma** (UI) / **DEF** (Açıklama kalıbı) | Tutarlı | Fiziksel hasar azaltma. Kalıplarda `DEF` korunur. |
| **SPEED** (Speed) | Hız, SPEED | **Hız** (UI) / **SPEED** (Açıklama kalıbı) | Tutarlı | Saldırı ve hareket sıklığı. Kalıplarda `SPEED` korunur. |
| **AP** (Ability Power) | Yetenek Gücü, AP | **Yetenek Gücü** (UI) / **AP** (Açıklama kalıbı) | Tutarlı | Yeteneklerin hasar ve kalkan gücünü artırır. |
| **PP** (Power Points) | Güç Puanı (PP), PP | **Güç Puanı** (UI) / **PP** (Açıklama kalıbı) | Tutarlı | Yetenek kullanmak için gereken mana/enerji barı. |
| **MAX_PP** | Maks PP | **Maks PP** | Tutarlı | Yetenek kullanım eşiği. |
| **SHIELD** | Kalkan, SHIELD | **Kalkan** (UI) / **SHIELD** (Açıklama kalıbı) | Tutarlı | Geçici can kalkanı. Kalıplarda `SHIELD` korunur. |
| **HP** (Health Points) | Can Puanı (HP), HP | **Can Puanı** (UI) / **HP** (Açıklama kalıbı) | Tutarlı | Can barı. |
| **SPE_DEF** (Special Defense) | Özel Savunma, SPE_DEF | **Özel Savunma** (UI) / **SPE_DEF** (Açıklama kalıbı) | Tutarlı | Özel hasara karşı direnç. |
| **RANGE** (Attack Range) | Saldırı Menzili, RANGE | **Saldırı Menzili** (UI) / **RANGE** (Açıklama kalıbı) | Tutarlı | Normal saldırı mesafesi (kare sayısı). |
| **LUCK** | Şans, LUCK | **Şans** (UI) / **LUCK** (Açıklama kalıbı) | Tutarlı | İkincil zar ve olasılıkları artıran stat. |
| **CRIT_CHANCE** | Kritik Şansı, CRIT_CHANCE | **Kritik Şansı** (UI) / **CRIT_CHANCE** (Açıklama kalıbı) | Tutarlı | Kritik vurma olasılığı (% cinsinden). |
| **CRIT_POWER** | Kritik Gücü, CRIT_POWER | **Kritik Gücü** (UI) / **CRIT_POWER** (Açıklama kalıbı) | Tutarlı | Kritik vuruş çarpanı / hasarı. |
| **XP** | Deneyim, XP | **XP** | Tutarlı | Seviye atlamak için gereken deneyim. |

---

## 2. Durum Etkileri (Status Conditions)

| İngilizce Terim | Kullanılan Türkçe Karşılık(lar) | Önerilen Tek Karşılık | Durum / Tutarsızlık | Açıklama / Bağlam |
| :--- | :--- | :--- | :--- | :--- |
| **BURN** | Yanık, BURN | **Yanık** (UI) / **BURN** (Kalıp) | Tutarlı | Saniyede maks HP'nin %5'i kadar TRUE hasar; iyileşmeyi ve FREEZE süresini %50 azaltır. |
| **FREEZE** | Donma, FREEZE | **Donma** (UI) / **FREEZE** (Kalıp) | Tutarlı | Hareketi, kaçmayı ve saldırmayı engeller. |
| **PARALYSIS** | Felç, PARALYSIS | **Felç** (UI) / **PARALYSIS** (Kalıp) | Tutarlı | SPEED etkisini %50 azaltır, kaçmayı engeller. |
| **SLEEP** | Uyku, SLEEP | **Uyku** (UI) / **SLEEP** (Kalıp) | Tutarlı | Hareketi, kaçmayı ve saldırmayı engeller; darbe aldıkça süresi kısalır. |
| **POISON / POISONED / POISONNED** | Zehir, POISON, POISONED, POISONNED | **Zehir** (UI) / **POISONED** (Kalıp) | Tutarsızlık (İngilizce SNAPSHOT kaynaklı: POISONED vs POISONNED) | Saniyede yığın başına maks HP'nin %5'i kadar TRUE hasar verir. |
| **SILENCE** | Susturma, SILENCE | **Susturma** (UI) / **SILENCE** (Kalıp) | Tutarlı | Yetenek kullanmayı ve PP kazanmayı engeller. |
| **CONFUSION** | Kafa Karışıklığı, CONFUSION | **Kafa Karışıklığı** (UI) / **CONFUSION** (Kalıp) | Tutarlı | Sürekli hedef değiştirir, bazen müttefike veya kendine vurur. |
| **WOUND** | Yara, WOUND | **Yara** (UI) / **WOUND** (Kalıp) | Tutarlı | Tüm kaynaklardan iyileşmeyi engeller. |
| **PROTECT** | Koruma, PROTECT | **Koruma** (UI) / **PROTECT** (Kalıp) | Tutarlı | Her türlü hasardan korur; iyileşme ve PP alımını durdurur. |
| **FLINCH** | Sinme, FLINCH | **Sinme** (UI) / **FLINCH** (Kalıp) | Tutarlı | Gelen hasarın %50'si SHIELD'ı deler. |
| **CHARM** | Büyülenme, CHARM | **Büyülenme** (UI) / **CHARM** (Kalıp) | Tutarlı | Hedefe saldırmayı engeller ve ona yaklaşmaya zorlar. |
| **LOCKED** | Kilitli, LOCKED | **Kilitli** (UI) / **LOCKED** (Kalıp) | Tutarlı | Hareket ve kaçmayı engeller, RANGE'i 1 yapar. |
| **CURSE** | Lanet, CURSE | **Lanet** (UI) / **CURSE** (Kalıp) | Tutarlı | Süre bitince birimi KO yapar; ikinci lanet anında KO eder. |
| **SAFEGUARD** | Güvence, SAFEGUARD | **Güvence** (UI) / **SAFEGUARD** (Kalıp) | Tutarlı | Durum bozukluklarına karşı bağışıklık sağlar. |
| **BLINDED** | Kör, BLINDED | **Kör** (UI) / **BLINDED** (Kalıp) | Tutarlı | Saldırı isabetini %50 azaltır. |
| **RAGE** | Öfke, RAGE | **Öfke** (UI) / **RAGE** (Kalıp) | Tutarlı | Hasarı 2 katına çıkarır, +80 SPEED verir. |
| **RESURRECTION** | Diriliş, RESURRECTION | **Diriliş** (UI) / **RESURRECTION** (Kalıp) | Tutarlı | Bir kez KO olmayı engeller ve temel canla diriltir. |
| **POSSESSED** | Ele Geçirilmiş, POSSESSED | **Ele Geçirilmiş** (UI) / **POSSESSED** (Kalıp) | Tutarlı | Geçici olarak karşı takım için savaşır. |
| **ARMOR_BREAK** | Zırh Kırma, ARMOR_BREAK | **Zırh Kırma** (UI) / **ARMOR_BREAK** (Kalıp) | Tutarlı | DEF ve SPE_DEF etkisini %50 azaltır. |
| **FATIGUE** | Yorgunluk, FATIGUE | **Yorgunluk** (UI) / **FATIGUE** (Kalıp) | Tutarlı | PP kazanımını %50 azaltır. |
| **POKERUS** | Pokérus, POKERUS | **Pokérus** | Tutarlı | 2.5 sn'de bir stat kazanır ve bitişik müttefiklere bulaşır. |

---

## 3. Hasar Tipleri (Damage Types)

| İngilizce Terim | Kullanılan Türkçe Karşılık(lar) | Önerilen Tek Karşılık | Durum / Tutarsızlık | Açıklama / Bağlam |
| :--- | :--- | :--- | :--- | :--- |
| **PHYSICAL** | fiziksel hasar, PHYSICAL | **Fiziksel Hasar** (UI) / **PHYSICAL** (Kalıp) | Tutarlı | Normal saldırılarla verilir, DEF ile azaltılır. |
| **SPECIAL** | özel hasar, SPECIAL | **Özel Hasar** (UI) / **SPECIAL** (Kalıp) | Tutarlı | Yeteneklerle verilir, SPE_DEF ile azaltılır. |
| **TRUE** | gerçek hasar, TRUE | **Gerçek Hasar** (UI) / **TRUE** (Kalıp) | Tutarlı | Savunma ve kalkanları delip geçen net hasar. |

---

## 4. Teknik Terimler (Technical Terms)

Oyun içi kılavuzda ve açıklamalarda yer alan konumsal ve tetikleyici terimler:

| İngilizce Terim | Kullanılan Türkçe Karşılık(lar) | Önerilen Tek Karşılık | Durum / Tutarsızlık | Açıklama / Bağlam |
| :--- | :--- | :--- | :--- | :--- |
| **ADJACENT** | bitişik, ADJACENT | **ADJACENT** (Kalıp) / **Bitişik** (Metin) | Tutarlı | Bir birimin etrafındaki 8 kare. |
| **ADJACENT_IN_THE_SAME_ROW** | aynı sırada bitişik | **Aynı Sırada Bitişik** | Tutarlı | Birimin solundaki ve sağındaki kareler. |
| **BASE** | temel, BASE | **BASE** (Kalıp) / **Temel** (Metin) | Tutarlı | Savaş başındaki çıplak stat değeri. |
| **BOARD_EFFECT** | Alan Efekti, BOARD_EFFECT | **BOARD_EFFECT** (Kalıp) / **Alan Efekti** | Tutarlı | Tahtadaki bir kare üzerinde süren efekt. |
| **CONE** | koni, CONE | **CONE** | Tutarlı | 90 derecelik açıyla ön alana yapılan atış. |
| **DASH** | atılma, DASH | **DASH** (Kalıp) / **Atılma** | Tutarlı | Hızlıca uzak bir kareye zıplama hareketi. |
| **FLY_AWAY** | uçup kaçma, FLY_AWAY | **FLY_AWAY** | Tutarlı | Tehlike anında menzildeki güvenli noktaya kaçma. |
| **INIMITABLE** | Taklit Edilemez | **Taklit Edilemez** | Tutarlı | Kopyalanamayan yetenekler. |
| **ON_ATTACK** | saldırıda, ON_ATTACK | **ON_ATTACK** | Tutarlı | Normal saldırı yapıldığı an tetiklenen etki. |
| **ON_CAST** | yetenek kullanınca, ON_CAST | **ON_CAST** | Tutarlı | Yetenek kullanıldığı (PP dolduğu) an tetiklenen etki. |
| **ON_HIT** | vuruşta, ON_HIT | **ON_HIT** | Tutarlı | Birim darbe aldığında tetiklenen etki. |
| **STRONGEST** | en güçlü, STRONGEST | **STRONGEST** (Kalıp) / **En Güçlü** | Tutarlı | Öncelik: Eşya sayısı > Kademe > Nadirlik. |

---

## 5. Sinerjiler ve Tipler (Synergies)

Türk oyuncu topluluğunda ve mevcut çeviride tip ve sinerji isimleri Türkçeleştirilmiştir. Açıklama metinlerindeki BÜYÜK_HARF kalıplar İngilizce oyun anahtarlarıdır (`FIRE`, `WATER` vb.) ve oyun motoru tarafından ikonla render edilir.

| İngilizce Terim | Kullanılan Türkçe Karşılık | Önerilen Tek Karşılık | Durum / Tutarsızlık | Notlar |
| :--- | :--- | :--- | :--- | :--- |
| **GRASS** | Çimen | **Çimen** | Tutarlı | Bitki tipi |
| **FIRE** | Ateş | **Ateş** | Tutarlı | Ateş tipi |
| **WATER** | Su | **Su** | Tutarlı | Su tipi |
| **FIGHTING** | Dövüş | **Dövüş** | Tutarlı | Dövüş tipi |
| **PSYCHIC** | Psişik | **Psişik** | Tutarlı | Psişik tipi |
| **DARK** | Karanlık | **Karanlık** | Tutarlı | Karanlık tipi |
| **STEEL** | Çelik | **Çelik** | Tutarlı | Çelik tipi |
| **GROUND** | Yer | **Yer** (veya Toprak) | **Tartışmalı** | Bazı oyuncular "Toprak" tercih edebilir; resmi Pokémon çevirilerinde "Yer" yaygındır. |
| **POISON** | Zehir | **Zehir** | Tutarlı | Zehir tipi |
| **DRAGON** | Ejderha | **Ejderha** | Tutarlı | Ejderha tipi |
| **FIELD** | Kır | **Kır** (veya Tarla / Ova) | **Tartışmalı** | Egg group kökenli; "Kır" kısa ve oturmuş. |
| **MONSTER** | Canavar | **Canavar** | Tutarlı | Canavar yumurta grubu |
| **HUMAN** | İnsan | **İnsan** | Tutarlı | İnsansı yumurta grubu |
| **AQUATIC** | Deniz | **Deniz** (veya Su Grubu) | **Tartışmalı** | Water egg group kökenli. |
| **BUG** | Böcek | **Böcek** | Tutarlı | Böcek tipi |
| **FLYING** | Uçan | **Uçan** | Tutarlı | Uçan tipi |
| **ROCK** | Kaya | **Kaya** | Tutarlı | Kaya tipi |
| **GHOST** | Hayalet | **Hayalet** | Tutarlı | Hayalet tipi |
| **FAIRY** | Peri | **Peri** | Tutarlı | Peri tipi |
| **ICE** | Buz | **Buz** | Tutarlı | Buz tipi |
| **FOSSIL** | Fosil | **Fosil** | Tutarlı | Fosil sinerjisi |
| **SOUND** | Ses | **Ses** | Tutarlı | Ses sinerjisi |
| **ARTIFICIAL**| Yapay | **Yapay** | Tutarlı | Yapay sinerjisi |
| **BABY** | Bebek | **Bebek** | Tutarlı | Bebek Pokémonlar |
| **LIGHT** | Işık | **Işık** | Tutarlı | Işık sinerjisi |
| **WILD** | Vahşi | **Vahşi** | Tutarlı | Vahşi sinerjisi |
| **AMORPHOUS**| Şekilsiz | **Şekilsiz** | Tutarlı | Amorphous yumurta grubu |
| **GOURMET** | Gurme | **Gurme** | Tutarlı | Aşçılık/yemek sinerjisi |
| **NORMAL** | Normal | **Normal** | Tutarlı | Normal tip |
| **ELECTRIC** | Elektrik | **Elektrik** | Tutarlı | Elektrik tipi |
| **FLORA** | Flora | **Flora** | Tutarlı | Çiçek/saksı sinerjisi |

---

## 6. Temel Oyun Mekanikleri ve Alanları (Core Gameplay & Zones)

| İngilizce Terim | Kullanılan Türkçe Karşılık(lar) | Önerilen Tek Karşılık | Durum / Tutarsızlık | Açıklama / Öneri |
| :--- | :--- | :--- | :--- | :--- |
| **carousel** | Karusel, Atlıkarınca | **Karusel** (veya **Atlıkarınca**) | **TUTARSIZLIK** | UI düğmelerinde `Karusel` (Karusel Aşamaları, Karusel Önceliği); wiki ve açıklamalarda ise `atlıkarınca` kullanılmış. Ürün sahibine sunuldu. |
| **board** | saha, alan, tahta | **Saha** (Savaş alanı) / **Alan** (Board effect) | Tutarlı | %95 oranında "saha" kullanılmış (`sahanda`, `sahaya yerleştir`). Auto Chess oyuncuları bazen "tahta" der; "saha" tutarlı tutuldu. |
| **bench** | yedek | **Yedek** | Tutarlı | Oyuncunun kenarda bekleyen birimlerinin alanı (`yedeğinde`, `yedekte boş yer`). |
| **shop** | dükkan | **Dükkan** | Tutarlı | Birim satın alınan yer. |
| **reroll / roll** | yenile, yenileme, tekrar çevir | **Yenile** (Düğme) / **Yenileme** (İsim) | Tutarlı | Dükkandaki birimleri 1 altına değiştirme işlemi. |
| **stage** | aşama | **Aşama** | Tutarlı | Oyunun faz/evre yapısı (`15. aşama`, `Aşama {{stage}}`). |
| **round** | tur | **Tur** | Tutarlı | Her bir savaş döngüsü (`PvE turları`, `bu tur`). |
| **item / items** | item, itemler | **Item** / **Itemler** | Tutarlı | Topluluk kuralı: "Eşya" yerine "Item" kullanılmıştır. |
| **component** | parça, item parçası | **Item parçası** | Tutarlı | Birleştirilmemiş temel eşyalar. |
| **tier** | kademe | **Kademe** | Tutarlı | İki parçanın birleşimiyle oluşan eşyalar ("2. kademe item") ve birim yıldız seviyesi için kullanılır. |
| **rarity** | nadirlik | **Nadirlik** | Tutarlı | Yaygın, Az Yaygın, Nadir, Epik vb. sınıfları. |
| **pool** | havuz | **Havuz** | Tutarlı | Ortak Pokémon / item havuzu. |
| **streak** | seri | **Seri** | Tutarlı | Galibiyet serisi (win streak), mağlubiyet serisi (lose streak). |
| **interest** | faiz | **Faiz** | Tutarlı | Biriktirilen her 10 altın başına alınan bonus gelir. |
| **gold** | altın, GOLD | **Altın** (Metin) / **GOLD** (Kalıp) | Tutarlı | Oyun içi para birimi. |
| **Elo** | Elo | **Elo** | Tutarlı | Dereceli derecelendirme puanı. |
| **double up** | Double Up | **Double Up** | Tutarlı | İkili eşli oyun modu. |
| **knock out / KO**| KO olmak, nakavt etmek | **KO olmak** / **Nakavt etmek** | Tutarlı | Birimin canının sıfırlanması. |
| **shards** | kırıntı | **Kırıntı** | Tutarlı | Paketlerden çıkan mükerrer ifadelerden kazanılan para birimi. |
| **boosters** | paket, paketler | **Paket** | Tutarlı | İfade açılan kart paketleri. |

---

## 7. Nadirlik Seviyeleri (Rarity)

| İngilizce Terim | Türkçe Karşılık | Önerilen Karşılık | Durum |
| :--- | :--- | :--- | :--- |
| **Common** | Yaygın | **Yaygın** | Tutarlı |
| **Uncommon** | Az Yaygın | **Az Yaygın** | Tutarlı |
| **Rare** | Nadir | **Nadir** | Tutarlı |
| **Epic** | Epik | **Epik** | Tutarlı |
| **Ultra** | Ultra | **Ultra** | Tutarlı |
| **Unique** | Eşsiz | **Eşsiz** | Tutarlı |
| **Legendary** | Efsanevi | **Efsanevi** | Tutarlı |
| **Mythical** | Mitolojik | **Mitolojik** | Tutarlı |
| **Hatch** | Yumurta | **Yumurta** | Tutarlı |
| **Special** | Özel | **Özel** | Tutarlı |

---

## 8. Öne Çıkan Tutarsızlıklar ve Alınan / Önerilen Kararlar

1. **Carousel: "Karusel" vs "Atlıkarınca"**:
   - `carousel`, `carousel_stages`, `carousel_priority` anahtarlarında **"Karusel"** kullanılmış.
   - `stage_type.carousel`, `wiki.faq.items_answer`, `town_encounter_description.SPINDA` anahtarlarında **"Atlıkarınca"** kullanılmış.
   - *Öneri*: Auto Chess / TFT Türk oyuncuları "Karusel" terimine alışıktır. Ya tamamen **"Karusel"** yapılmalı ya da tamamen Türkçe olan **"Atlıkarınca"** seçilmelidir. Karar listesinde ürün sahibine sunulmuştur.

2. **Ground & Field & Aquatic Çevirileri**:
   - `GROUND`: "Yer" (alternatif: "Toprak").
   - `FIELD`: "Kır" (alternatif: "Ova", "Saha").
   - `AQUATIC`: "Deniz" (alternatif: "Su Grubu").
   - *Öneri*: Mevcut hali kısa ve ekran alanına iyi oturmaktadır; topluluk tarafından benimsenmiştir.

3. **Bracket İçindeki LK Çevirisi: `[sometimes,LK]` vs `[bazen,LK]`**:
   - `status_description.CONFUSION` içinde `[bazen,LK]` kullanılmıştır. `scripts/build-translation.mjs` bunu desteklemektedir.
   - Upstream oyun kodunda tag içinde "bazen" kelimesi şans ikonuyla görünmektedir.

4. **Pokémon ve Eşya İsimleri**:
   - Kural: Türk oyuncular uluslararası adları kullandığı için Pokémon isimleri (1200 adet) ve Item isimleri (358 adet) %100 İngilizce orijinal hallerinde bırakılmıştır.

---

## 9. İsim Kelimeleri Mini Sözlüğü (Name Words Mini Glossary)

Eşya (`item.*`), hareket/yetenek (`ability.*`) ve zindan/harita (`map.*`) isimlerinde sıkça tekrar eden kök kelimelerin standartlaştırılmış karşılıkları:

| İngilizce Terim | Standart Türkçe Karşılık | Örnekler / Kullanım |
| :--- | :--- | :--- |
| **Band** | Bandı / Bant | Focus Band -> Odak Bandı, Muscle Band -> Kas Bandı, Choice Band -> Tercih Bandı |
| **Belt** | Kemeri | Black Belt -> Siyah Kemer, Big Eater Belt -> Obur Kemeri |
| **Ribbon** | Kurdelesi | Mach Ribbon -> Mach Kurdelesi, Lucky Ribbon -> Şans Kurdelesi |
| **Scarf** | Eşarbı / Atkısı | Silk Scarf -> İpek Eşarp, Choice Scarf -> Tercih Eşarbı |
| **Lens** | Lensi | Scope Lens -> Dürbün Lensi, Wide Lens -> Geniş Lens, Power Lens -> Güç Lensi |
| **Specs / Glasses** | Gözlüğü | Choice Specs -> Tercih Gözlüğü, Black Glasses -> Siyah Gözlük |
| **Orb** | Küresi | Life Orb -> Yaşam Küresi, Flame Orb -> Alev Küresi, Blue Orb -> Mavi Küre |
| **Stone** | Taşı | Fire Stone -> Ateş Taşı, Water Stone -> Su Taşı, Dawn Stone -> Şafak Taşı |
| **Rock** | Kayası | Damp Rock -> Nem Kayası, Heat Rock -> Isı Kayası, King's Rock -> Kral Kayası |
| **Berry** | Meyvesi | Oran Berry -> Oran Meyvesi, Sitrus Berry -> Sitrus Meyvesi |
| **Gem** | Mücevheri | Fire Gem -> Ateş Mücevheri, Field Gem -> Kara Mücevheri, Normal Gem -> Normal Mücevher |
| **Memory** | Belleği | Fire Memory -> Ateş Belleği, Field Memory -> Kara Belleği, Memory Discs -> Bellek Diskleri |
| **Wand** | Asası | Guiding Wand -> Rehber Asa, Warp Wand -> Işınlanma Asası, Petrify Wand -> Taşlaştırma Asası |
| **Mask** | Maskesi | Teal Mask -> Camgöbeği Maske, Hearthflame Mask -> Ocakateşi Maskesi |
| **Sweet / Flavor** | Şekeri / Aroması | Strawberry Sweet -> Çilek Şekeri, Vanilla Flavor -> Vanilya Aroması |
| **Gift / Bundle** | Hediyesi / Paketi | Legendary Gift -> Efsanevi Hediye, Ticket Bundle -> Bilet Paketi |
| **Punch** | Yumruğu / Yumruk | Fire Punch -> Ateş Yumruğu, Mach Punch -> Mach Yumruğu, Drain Punch -> Emen Yumruk |
| **Kick** | Tekmesi / Tekme | Blaze Kick -> Alev Tekmesi, High Jump Kick -> Yüksek Zıplama Tekmesi |
| **Beam** | Işını | Hyper Beam -> Hiper Işın, Solar Beam -> Güneş Işını, Ice Beam -> Buz Işını |
| **Claw** | Pençesi | Dragon Claw -> Ejderha Pençesi, Shadow Claw -> Gölge Pençesi |
| **Fang** | Dişi | Fire Fang -> Ateş Dişi, Thunder Fang -> Yıldırım Dişi, Poison Fang -> Zehirli Diş |
| **Tail** | Kuyruğu | Iron Tail -> Demir Kuyruk, Aqua Tail -> Su Kuyruğu |
| **Dance** | Dansı | Dragon Dance -> Ejderha Dansı, Swords Dance -> Kılıç Dansı |
| **Wave / Storm** | Dalgası / Fırtınası | Sludge Wave -> Çamur Dalgası, Leaf Storm -> Yaprak Fırtınası |
| **Cave / Cavern** | Mağarası / İni | Beach Cave -> Kumsal Mağarası, Crystal Cave -> Kristal Mağarası, Limestone Cavern -> Kireçtaşı İni |
| **Forest / Woods** | Ormanı / Korusu | Apple Woods -> Elma Ormanı, Foggy Forest -> Sisli Orman, Tiny Woods -> Küçük Koru |
| **Mt / Mountain** | Dağı | Mt. Steel -> Çelik Dağı, Dark Ice Mountain -> Karanlık Buz Dağı |
| **Peak** | Zirvesi | Sky Peak -> Gök Zirvesi, Mt Thunder Peak -> Gök Gürültüsü Zirvesi |
| **Maze** | Labirenti | Rock Maze -> Kaya Labirenti, Electric Maze -> Elektrik Labirenti |
| **Path** | Yolu | Rock Path 1 -> Kaya Yolu 1, Forest Path -> Orman Yolu |
| **Tower / Spire** | Kulesi | Temporal Tower -> Zaman Kulesi, Temporal Spire -> Zamansal Kule |
