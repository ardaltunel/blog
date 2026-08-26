# Blog

A modern static blog system powered by Supabase and designed to run on GitHub Pages.

This project provides a complete blog infrastructure with user authentication, post management, category organization, image uploads, and an administrator approval system.


---

# 📸 Preview

<p align="center">
  <img width="1891" height="900" alt="Blog application preview" src="https://github.com/user-attachments/assets/b1d228f0-c8fc-4357-8f8f-3776570adb8a" />
</p>

---

## 🌍 Features

* GitHub Pages support
* Supabase database integration
* User registration and authentication
* Admin dashboard
* Blog post management
* Category system
* Thumbnail upload functionality
* Supabase Storage integration
* Responsive design
* Fully static frontend architecture
* No PHP required

---

# 🚀 Technologies Used

<p align="left">
  <img src="https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img src="https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img src="https://img.shields.io/badge/GitHub_Pages-121013?style=for-the-badge&logo=github&logoColor=white">
</p>

---

# 📂 Project Structure

```text
.
├── assets/
│   ├── css/
│   ├── data/
│   ├── favicon/
│   ├── images/
│   ├── js/
│   └── logo/
├── database/
│   └── supabase/
│       ├── schema.sql
│       └── seed.sql
├── index.html
├── admin.html
├── add-post.html
├── signin.html
└── signup.html
```

---

# ⚙️ Supabase Setup

## 1. Create a Supabase Project

Visit:

🔗 https://supabase.com

Create a new Supabase project.

During project creation, keep the following options enabled:

* Enable Data API
* Automatically expose new tables
* Enable automatic Row Level Security

---

## 2. Run the SQL Files

Open the following section in the Supabase Dashboard:

```text
SQL Editor
```

Run the SQL files in the following order:

```text
database/supabase/schema.sql
```

Then run:

```text
database/supabase/seed.sql
```

---

# 🔐 Authentication Settings

In the Supabase Dashboard, open:

```text
Authentication > Providers
```

Make sure that the following provider is enabled:

```text
Email Provider
```

Email confirmation may be disabled during development. However, enabling it in production is recommended for improved account security.

---

# 👑 Granting Administrator Access

To create the first administrator account:

1. Register an account through the website.
2. Open the Supabase SQL Editor.
3. Run the following query:

```sql
UPDATE public.authors
SET is_admin = true
WHERE user_id = (
    SELECT id
    FROM auth.users
    WHERE email = 'YOUR_EMAIL_ADDRESS'
);
```

Replace `YOUR_EMAIL_ADDRESS` with the email address of the account that should receive administrator privileges.

---

# 🔑 Supabase API Configuration

In the Supabase Dashboard, open:

```text
Project Settings > API
```

Copy the following values:

* Project URL
* Anon public key

Then edit the following file:

```text
assets/js/supabase-config.js
```

Add your Supabase project credentials:

```js
window.SUPABASE_CONFIG = {
    url: 'https://PROJECT_ID.supabase.co',
    anonKey: 'SUPABASE_ANON_KEY',
    imageBasePath: './assets/images/',
    storageBucket: 'blog-images'
};
```

> ⚠️ **Security Notice:** Never use or expose the `service_role` key in frontend code. Only the anonymous public key should be used in the browser.

---

# 🖼️ Storage System

The project uses a public Supabase Storage bucket named:

```text
blog-images
```

The storage system works as follows:

* Newly uploaded images are stored in Supabase Storage.
* Existing static images are loaded from the `assets/images/` directory.
* Thumbnail URLs are generated automatically.
* Uploaded images can be associated with blog posts.

---

# 🚀 Deploying to GitHub Pages

1. Upload the project files to a GitHub repository.
2. Open the repository settings.
3. Navigate to:

```text
Settings > Pages
```

4. Select the following options:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

5. Save the configuration.
6. Open the generated GitHub Pages URL after deployment is complete.

The website URL will usually follow this format:

```text
https://username.github.io/repository-name/
```

---

# 💻 Local Development

Install the pinned dependencies and start the cache-safe development server:

```bash
npm ci
npm run dev
```

Then open the following address in your browser:

```text
http://127.0.0.1:5500/
```

The bundled development server disables browser caching so CSS and JavaScript changes are visible immediately.

You may also use another static development server, such as:

```bash
python -m http.server 4173
```

or:

```bash
npx serve .
```

---

# 🎯 Project Purpose

This project was developed to:

* Build a modern blog platform
* Gain practical experience with Supabase
* Develop authentication systems
* Practice static frontend architecture
* Create backend-like functionality for a GitHub Pages website
* Learn database, storage, and authorization concepts
* Improve responsive web development skills

---

# 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Made with ❤️ by **Arda Altunel**
