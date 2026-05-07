# GitHub Pages + Supabase Kurulum

Bu klasor GitHub Pages icin hazirlanmis statik blog surumudur. PHP calistirmaz; verileri Supabase'den JavaScript ile okur.

## 1. Supabase projesi olustur

1. https://supabase.com adresinden yeni proje olustur.
2. Proje olusturma ekraninda `Enable Data API`, `Automatically expose new tables` ve `Enable automatic RLS` acik kalsin.
3. Proje acilinca sol menuden `SQL Editor` ekranina gir.
4. Once `supabase/schema.sql` icerigini calistir.
5. Ardindan `supabase/seed.sql` icerigini calistir.

`seed.sql`, eski `blog.sql` dosyasindaki dogrulanmis blog yazilarini, kategorileri ve gorunen yazar bilgilerini aktarir. Eski kullanici e-posta/sifre alanlari bilerek aktarilmadi.

## 2. Auth ayarlari

Supabase panelinde `Authentication > Providers` ekraninda `Email` provider acik olmali.

Gelisme sirasinda hizli test icin email confirmation kapatilabilir. Canlida acik birakmak daha guvenlidir.

Ilk admin hesabi icin:

1. Sitedeki `Signup` ekranindan kendi hesabini olustur.
2. Supabase `SQL Editor` ekraninda su sorguyu kendi email adresinle calistir:

```sql
update public.authors
set is_admin = true
where user_id = (
    select id from auth.users
    where email = 'SENIN_EMAIL_ADRESIN'
);
```

Bundan sonra o hesap dashboard uzerinden bekleyen yazilari onaylayabilir.

## 3. Supabase API bilgilerini ekle

Supabase panelinde:

1. `Project Settings > API` ekranina gir.
2. `Project URL` degerini kopyala.
3. `Project API keys` altindaki `anon public` key degerini kopyala.
4. `js/supabase-config.js` dosyasini duzenle:

```js
window.SUPABASE_CONFIG = {
    url: 'https://PROJECT_ID.supabase.co',
    anonKey: 'SUPABASE_ANON_KEY',
    imageBasePath: './images/',
    storageBucket: 'blog-images'
};
```

`service_role` key kullanma. GitHub Pages herkese acik oldugu icin sadece `anon public` key kullanilir.

## 4. Storage

`schema.sql`, `blog-images` adinda public bir Storage bucket olusturur. Yeni blog yazisi yuklenirken thumbnail bu bucket'a gider ve post icine public URL olarak kaydedilir.

Eski gorseller repo icindeki `images/` klasorunden gelir. Yeni yuklenen gorseller Supabase Storage public URL'siyle kaydedilir.

## 5. GitHub Pages'e yukle

1. Bu klasorun icindeki dosyalari GitHub reposuna yukle.
2. GitHub'da `Settings > Pages` ekranina gir.
3. `Deploy from a branch` sec.
4. Branch olarak `main`, klasor olarak `/root` sec.
5. Kaydet ve verilen GitHub Pages URL'sini ac.

## Local test

Bu klasorde local server calistirmak icin:

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:4173 -t .
```

Sonra su adresi ac:

```text
http://127.0.0.1:4173/
```
