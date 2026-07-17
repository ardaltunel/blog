# Güvenlik Denetimi Sonucu

Denetim tarihi: 17 Temmuz 2026

Kapsam: GitHub Pages üzerinde çalışan sekiz HTML sayfası, tüm uygulama JavaScript dosyaları, CSS, yerel veri kaynağı, Supabase şeması/RLS/Storage politikaları, GitHub Actions, bağımlılıklar ve Git geçmişi.

## Genel Durum

Proje; statik HTML/CSS/JavaScript istemcisi, Supabase Auth/PostgREST/Storage ve API erişilemediğinde kullanılan salt okunur `assets/data/blog-data.js` verisinden oluşur. PHP veya başka bir sunucu çalışma zamanı yoktur ve eklenmemiştir.

İstemci tarafındaki yüksek riskli XSS, gevşek URL parametresi, kontrolsüz URL/görsel, hata sızıntısı ve bağımlılık sorunları kod üzerinde giderildi. Supabase için güvenli şema ve politikalar `database/supabase/schema.sql` içine yazıldı. Ancak bu SQL canlı projeye otomatik uygulanmadı; canlı veritabanında yetki ve veri değişikliği kullanıcı onayıyla yapılmalıdır. Bu migration uygulanana kadar canlı Supabase bulguları açık kabul edilmelidir.

## Tespit Edilen Açıklar

### Kritik

Tespit edilmedi.

### Yüksek

1. **Stored DOM XSS:** API/JSON kaynaklı `post.body` doğrudan HTML olarak render ediliyordu. Etkilenen bölüm: `assets/js/app.js`, yazı detay render akışı. DOMPurify 3.4.12 ile dar etiket/attribute listesi ve URL hook'ları eklendi.
2. **Supabase yetki yükseltme yüzeyi:** `SECURITY DEFINER` fonksiyonlar `public` şemasında `anon` ve `authenticated` rollerine çalıştırılabiliyordu. Etkilenen bölüm: `database/supabase/schema.sql`. Fonksiyonlar `private` şemasına taşındı, boş `search_path`, minimum `EXECUTE` yetkisi ve rol koruma trigger'ı eklendi.
3. **Anonim Storage yükleme ve bucket listeleme:** Anonim avatar yükleme politikası ile public bucket listeleme politikası kötüye kullanıma açıktı. Etkilenen bölüm: Storage politikaları. Anonim yükleme/listeleme kaldırıldı; yükleme yolu `uploads/{auth.uid()}/{avatars|posts}/...`, MIME, uzantı, boyut ve sahiplik ile sınırlandı.
4. **Canlı veritabanı durumu:** Salt okunur Supabase Advisor kontrolü, yukarıdaki fonksiyon ve bucket bulgularını canlı projede doğruladı. Repository düzeltmesi hazırdır ancak SQL uygulanana kadar canlı risk sürer.

### Orta

1. **Gevşek `id` dönüşümü:** `Number`/benzeri dönüşümler canonical olmayan değerleri güvenli biçimde ayırmıyordu. `id`, `page` ve `view` için merkezi şema eklendi (`assets/js/security.js:26-89`).
2. **Kontrolsüz URL ve görsel kaynakları:** API/JSON kaynaklı `href` ve `src` değerleri harici origin, tehlikeli protokol veya traversal içerebiliyordu. Merkezi route, dahili yönlendirme, içerik linki ve görsel allowlist yardımcıları eklendi (`assets/js/security.js:92-246`).
3. **Yüklenen dosyanın yalnız MIME tipine güvenmesi:** PNG/JPEG/WebP boyut ve MIME kontrolüne ek olarak magic-byte imza doğrulaması eklendi (`assets/js/security.js:309`).
4. **Kayıt avatarı akışı:** Canlı projede e-posta onayı açık olduğundan kayıt cevabı oturum döndürmüyor ve güvenli Storage politikası anonim yüklemeyi reddediyor. Onay URL'si `Profile` görünümüne bağlandı; oturumdan sonra sahiplik kontrollü yükleme eklendi (`assets/js/auth-pages.js:54`, `:154`, `:373`).
5. **Yönetici işlemlerinde tek nesne zorlaması:** `Make Admin` ve `Delete` işlemleri boş/çoklu cevapta “Cannot coerce...” üretebiliyordu. İşlemler artık `.select('id')` dizisini doğruluyor, satır dönmezse güvenli hata gösteriyor (`assets/js/auth-pages.js:656`).
6. **Ham servis hataları:** Supabase hata metinleri kullanıcıya ve konsola sızabiliyordu. Ortak, sınırlı ve `textContent` kullanan hata mesajları eklendi.

### Düşük

1. CSP ve referrer politikası yoktu; tüm sayfalara kaynağa özel meta CSP ve `strict-origin-when-cross-origin` eklendi.
2. Inline script/event/style kullanımları CSP'yi zayıflatıyordu; ayrı dosyalara taşındı.
3. CDN bağımlılıkları çalışma zamanında haricî ve sabitlenmemişti; Supabase, DOMPurify, Montserrat ve Lucide dosyaları tam sürümlerden yerel vendor alanına alındı.
4. Keep-alive workflow'u gereksiz yazma yetkisine sahipti; `contents: read`, timeout, sessiz response ve tam commit SHA pinleri eklendi.
5. Form uzunlukları ve dosya sınırları eksikti; HTML ve JavaScript doğrulamaları birlikte eklendi.

### Bilgilendirme

- Kullanılan Supabase `anon` anahtarı istemciye açık olması tasarlanan public anahtardır; `service_role` secret değildir. JWT rolü çalışırken ayrıca `anon` olarak doğrulanır.
- İncelenen uygulama query parametreleri yalnızca `id`, `page` ve `view` oldu. `redirect`, `url`, `returnUrl`, `next`, `search`, `tag` benzeri parametreler kullanılmıyor ve merkezi yardımcı tarafından reddediliyor.
- `fetch`, Axios, XHR, iframe, `postMessage`, dinamik script, `eval`, string timer veya kullanıcı kontrollü dosya yolu üretimi bulunmadı.
- `post.html?id=122` yapısı tek başına açık değildir. Merkezi doğrulama sonrası mevcut linkleri ve SEO davranışını korumak için routing değiştirilmedi.

### Yanlış Pozitifler

- Public Supabase URL'si ve `anon` anahtarı secret taramasında tek başına gizli bilgi sayılmadı.
- Yerel vendor dosyalarındaki `fetch`, `Object.assign` ve dahili auth yönlendirmeleri uygulama kaynak kodu bulgusu olarak değerlendirilmedi; paket sürümü ve `npm audit` sonucu üzerinden denetlendi.
- HTML blog içeriği işlev gereğidir; kaldırılmak yerine dar DOMPurify profiliyle sanitize edildi.

### Güvenlik Açığı Olmayan Kötü Uygulamalar

- Eski editör bağımlılığı runtime CDN'den yükleniyordu ve bakım/supply-chain yükü oluşturuyordu. Yerel, sanitize edilen küçük editör ile değiştirildi.
- Birden fazla Supabase istemcisi aynı auth storage anahtarını kullanıyordu. Genel veri ve auth akışı tek istemcide birleştirildi; izole admin kayıt istemcisine ayrı storage anahtarı verildi.
- Üretim cache'i eski güvenlik dosyalarını tutabilirdi. Yerel uygulama dosyalarına `v=8` cache-busting eklendi.

## Uygulanan Düzeltmeler

- Merkezi `SecurityUtils`: parametre şeması, route allowlist, güvenli iç/dış URL, görsel allowlist, UUID/metin/e-posta/parola/dosya doğrulama.
- DOMPurify 3.4.12 ile blog ve UI için ayrı, dar sanitizasyon profilleri.
- `innerHTML`, inline event handler, dinamik script ve ham hata render akışları kaldırıldı.
- Güvenli hata bileşeni, response tip/satır/list limitleri ve ağ fallback'leri eklendi.
- Auth token kalıcı `localStorage` yerine sekme ömürlü `sessionStorage` alanına taşındı.
- Profil görseli ve thumbnail yüklemeleri kullanıcı UUID yolu, magic-byte kontrolü ve 2/5 MB limitleriyle sınırlandı.
- Admin favicon'u eklendi ve tüm başlıklardaki `/` ayıracı `|` olarak değiştirildi.
- Add/Edit Post HTML kaynak görünümü kaldırıldı; her iki akış aynı güvenli editörü kullanıyor.

## URL Parametresi Güvenliği

- `id`: `/^[1-9]\d*$/`, en fazla 9 basamak, `1..999999999`, `Number.isSafeInteger`, tek değer zorunluluğu.
- `page`: canonical pozitif tam sayı, en fazla 6 basamak, üst sınır 100000.
- `view`: sabit dashboard allowlist'i.
- Bilinmeyen, tekrarlı, array biçimli ve prototype anahtarları reddedilir.
- Geçersiz yazı ID'si ham girdiyi yansıtmadan “Yazı bulunamadı.” gösterir.

## XSS Önlemleri

- Blog HTML'sinde `script`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `style`, event attribute'ları ve inline style yasaktır.
- `javascript:`, `data:`, `vbscript:`, `file:`, protocol-relative ve traversal içeren URL'ler reddedilir.
- Harici HTTPS linklere sanitizasyon sırasında `target="_blank" rel="noopener noreferrer nofollow"` eklenir.
- UI metinleri `textContent`, `createElement`, `replaceChildren` veya sanitize edilmiş `DocumentFragment` ile oluşturulur.

## Bağımlılık Güncellemeleri

- `@supabase/supabase-js` 2.110.7
- `dompurify` 3.4.12
- `@fontsource/montserrat` 5.2.8
- `lucide-static` 1.25.0
- ESLint 10.7.0 ve `eslint-plugin-security` 4.0.1
- Tüm sürümler tam olarak sabitlendi; lock dosyası eklendi. `npm outdated` boş, `npm audit` sonucu 0 açık.

## GitHub Actions Güvenliği

- Tüm action kullanımları tam 40 karakter commit SHA ile sabitlendi.
- Workflow varsayılan yetkisi `contents: read`; checkout credentials kalıcı değil.
- PR/push için build, lint, test, statik güvenlik taraması, link kontrolü, audit ve Gitleaks geçmiş taraması eklendi (`.github/workflows/security-ci.yml`).
- Güvenilmeyen event değeri shell komutuna yerleştirilmiyor; `pull_request_target` kullanılmıyor.

## Eklenen Testler

- İstenen 14 bozuk/kötü niyetli `id` girdisinin tamamı.
- Open redirect, `data:` URL ve search SVG örnekleri.
- Route/view allowlist, duplicate parametre ve prototype anahtarı testleri.
- İçerik linki/görsel origin allowlist testleri.
- Metin, e-posta, parola, MIME, boyut ve image magic-byte testleri.
- Eski içeriklerde metin olarak saklanan `\\r\\n`, `\\n` ve `\\r` dizilerinin normalizasyon testi.
- Tehlikeli JavaScript/inline HTML kalıp taraması ve yerel link doğrulaması.

## Çalıştırılan Komutlar

```text
npm ci --ignore-scripts
npm run check
npm outdated --json
npm audit --audit-level=high
node --check <uygulama dosyaları>
git diff --check
git geçmişi gizli bilgi taraması
```

`npm audit fix --force` kullanılmadı.

## Test Sonuçları

- Build: geçti.
- ESLint + security plugin: geçti.
- Unit test: 9/9 geçti.
- Statik güvenlik taraması: 27 kaynak dosyası geçti.
- Link testi: 8/8 HTML sayfası geçti.
- Dependency audit: 0 açık; outdated paket yok.
- Git geçmişi: private key, GitHub token, AWS key, Supabase service-role göstergesi ve `.env` bulunmadı.
- Tarayıcı: ana liste 9 yazı render etti; `id=122` açıldı; 14 geçersiz ID güvenli hata verdi.
- Masaüstü/mobil: yatay taşma ve bozuk görsel yok; mobil menü görünür; yazı başlığı kapsayıcıya sığıyor.
- Sekiz sayfanın tamamı: CSP mevcut, inline handler/tehlikeli link yok, loading takılı kalmıyor.
- Console: hata/uyarı yok.
- Network asset origin'leri: yalnız yerel origin ve yapılandırılmış Supabase origin'i.

## Değiştirilen Dosyalar

- Sayfalar: `index.html`, `post.html`, `category.html`, `signin.html`, `signup.html`, `admin.html`, `add-post.html`, `404.html`.
- Uygulama: `assets/js/security.js`, `app.js`, `auth.js`, `auth-pages.js`, `main.js`, `theme-bootstrap.js`, `rich-editor.js`.
- Stil/vendor: `assets/css/style.css`, `assets/vendor/**`.
- Veritabanı: `database/supabase/schema.sql`.
- CI/araçlar: `.github/workflows/*.yml`, `.gitignore`, `package.json`, `package-lock.json`, `eslint.config.js`, `scripts/**`, `tests/**`.

## Manuel Yapılması Gerekenler

1. Canlı veritabanının yedeğini alın ve `database/supabase/schema.sql` dosyasını Supabase SQL Editor/migration üzerinden uygulayın.
2. Uygulama sonrası Supabase Security ve Performance Advisor'ı yeniden çalıştırın; RLS/Storage/fonksiyon uyarılarının kapandığını doğrulayın.
3. Supabase Auth ayarlarında leaked-password protection özelliğini açın.
4. Auth URL Configuration içinde `https://ardaltunel.github.io/blog/admin.html` yönlendirmesine izin verin; e-posta onayından sonra Profile ekranı açılmalıdır.
5. Migration sonrası gerçek admin hesabıyla `Make Admin`, `Remove Admin`, `Delete Profile`, post publish/delete ve profil görseli yükleme smoke testlerini yapın. Denetim sırasında canlı veri değiştirilmedi.
6. GitHub Pages özel response header sağlamaz. Güçlü clickjacking koruması için header ekleyebilen CDN/proxy üzerinden `Content-Security-Policy: frame-ancestors 'none'` veya `X-Frame-Options: DENY` yayınlayın.
7. `Delete Profile` Auth kullanıcısını silmez; statik istemciye `service_role` koymadan Auth kullanıcısı silinemez. Tam hesap silme gerekiyorsa doğrulanmış bir Supabase Edge Function eklenmelidir.

## Kalan Riskler

- Güvenli SQL migration canlı projeye uygulanana kadar mevcut RLS/fonksiyon/Storage bulguları devam eder.
- Statik mimaride auth token HttpOnly cookie'ye taşınamaz; token sekme ömürlü `sessionStorage` içindedir. Başarılı bir aynı-origin XSS oturumu okuyabilir; CSP ve sanitizasyon bu riski azaltır ancak sunucu tabanlı cookie kadar güçlü değildir.
- Meta CSP, `frame-ancestors` direktifini uygulamaz ve HTTP response header kadar güçlü değildir. GitHub Pages sınırı nedeniyle clickjacking tamamen kod içinden kapatılamaz.
- Public bucket nesneleri URL biliniyorsa okunabilir; listeleme kapalıdır fakat içerik gizli kabul edilmemelidir.
- E-posta onayı açıkken seçilen kayıt avatarı anonim olarak yüklenmez. Kullanıcı aynı veya başka cihazda onaydan sonra Profile ekranında dosyayı tekrar seçmelidir; bu güvenlik için bilinçli bir kısıttır.
- Yetkilendirme hiçbir zaman frontend kontrollerine dayanmaz; gerçek sınır RLS ve Storage politikalarıdır.
