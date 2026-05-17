# Blog

Supabase destekli, GitHub Pages üzerinde çalışan modern statik blog sistemi.

Bu proje; kullanıcı sistemi, blog yönetimi, kategori yapısı ve admin onay sistemi bulunan modern bir blog altyapısı sunmaktadır.

## 🌍 Özellikler

- GitHub Pages desteği
- Supabase veritabanı entegrasyonu
- Kullanıcı kayıt & giriş sistemi
- Admin paneli
- Blog yazı yönetimi
- Kategori sistemi
- Thumbnail yükleme sistemi
- Supabase Storage desteği
- Responsive tasarım
- Tamamen statik frontend yapısı
- PHP gerektirmez

---

# 🚀 Kullanılan Teknolojiler

<p align="left">
  <img src="https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img src="https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img src="https://img.shields.io/badge/GitHub_Pages-121013?style=for-the-badge&logo=github&logoColor=white">
</p>

---

# 📂 Proje Yapısı

```text
.
├── css/
├── js/
├── images/
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── index.html
└── dashboard.html
```

---

# ⚙️ Supabase Kurulumu

## 1. Supabase Projesi Oluştur

🔗 https://supabase.com

Yeni bir Supabase projesi oluşturun.

Proje oluştururken:

- Enable Data API
- Automatically expose new tables
- Enable automatic RLS

ayarlarını açık bırakın.

---

## 2. SQL Dosyalarını Çalıştır

Supabase panelinde:

```text
SQL Editor
```

ekranına girin.

Sırasıyla:

```text
supabase/schema.sql
```

ve ardından:

```text
supabase/seed.sql
```

dosyalarını çalıştırın.

---

# 🔐 Authentication Ayarları

Supabase panelinde:

```text
Authentication > Providers
```

ekranından:

```text
Email Provider
```

aktif olmalıdır.

Geliştirme sürecinde email doğrulama kapatılabilir, ancak canlı ortamda açık bırakılması önerilir.

---

# 👑 Admin Yetkisi Verme

İlk admin hesabı için:

1. Site üzerinden hesap oluşturun.
2. Supabase SQL Editor ekranında aşağıdaki sorguyu çalıştırın:

```sql
update public.authors
set is_admin = true
where user_id = (
    select id from auth.users
    where email = 'YOUR_EMAIL_ADDRESS'
);
```

---

# 🔑 Supabase API Ayarları

Supabase panelinde:

```text
Project Settings > API
```

ekranına girin.

Aşağıdaki bilgileri alın:

- Project URL
- anon public key

Daha sonra:

```text
js/supabase-config.js
```

dosyasını düzenleyin.

```js
window.SUPABASE_CONFIG = {
    url: 'https://PROJECT_ID.supabase.co',
    anonKey: 'SUPABASE_ANON_KEY',
    imageBasePath: './images/',
    storageBucket: 'blog-images'
};
```

⚠️ Güvenlik nedeniyle `service_role` key kullanmayın.

---

# 🖼️ Storage Sistemi

Proje;

```text
blog-images
```

isimli public storage bucket kullanır.

- Yeni yüklenen görseller Supabase Storage'a gider.
- Eski görseller `images/` klasöründen okunur.
- Thumbnail URL'leri otomatik oluşturulur.

---

# 🚀 GitHub Pages Yayına Alma

1. Dosyaları GitHub repository içerisine yükleyin.
2. Repository ayarlarından:

```text
Settings > Pages
```

ekranına girin.

3. Şunları seçin:

```text
Deploy from a branch
Branch: main
Folder: /root
```

4. Kaydedin ve GitHub Pages linkini açın.

---

# 💻 Local Test

Local server başlatmak için:

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:4173 -t .
```

Ardından:

```text
http://127.0.0.1:4173/
```

adresini açın.

---

# 🎯 Proje Amacı

Bu proje;

- Modern blog sistemi geliştirmek
- Supabase pratiği yapmak
- Authentication sistemleri geliştirmek
- Static frontend mimarisi oluşturmak
- GitHub Pages üzerinde backend benzeri yapı kurmak

amacıyla geliştirilmiştir.

---

# 📄 License

This project is licensed under the MIT License.

For more details:
<a href="LICENSE">LICENSE</a>

---

Made with ❤️ by Arda Altunel
