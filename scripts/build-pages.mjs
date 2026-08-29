import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import sanitizeHtml from 'sanitize-html';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
if (dirname(output) !== root || !output.startsWith(`${root}${sep}`)) {
    throw new Error('Unsafe build output path.');
}

const defaultSiteUrl = 'https://ardaltunel.github.io/blog/';
const siteUrl = new URL(process.env.SITE_URL || defaultSiteUrl);
if (!siteUrl.pathname.endsWith('/')) {
    siteUrl.pathname += '/';
}
const siteBaseUrl = siteUrl.href;
const basePath = siteUrl.pathname;
const siteOrigin = siteUrl.origin;
const siteName = 'ARDALTUNEL';
const assetVersion = '75';
const postsPerPage = 9;
const maxPosts = 2000;
const homeDescription = 'Arda Altunel’in yazılım, teknoloji, tasarım, bilim ve yaşam üzerine blog yazıları.';
const logoUrl = new URL('assets/logo/logo.png', siteBaseUrl).href;
const fallbackAvatar = new URL('assets/images/no-user-photo.svg?v=2', siteBaseUrl).href;
const reservedPaginationSlugs = Array.from(
    { length: Math.ceil(maxPosts / postsPerPage) - 1 },
    (_, index) => String(index + 2)
);
const reservedPostSlugs = ['assets', 'kategori', 'yazi', 'yeni-blog-ekle', ...reservedPaginationSlugs];
const csp = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-src https://www.youtube-nocookie.com; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https://bdadbqlkmdwzzkrwetrf.supabase.co https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://bdadbqlkmdwzzkrwetrf.supabase.co; media-src 'none'; worker-src 'none'; manifest-src 'self'; upgrade-insecure-requests";

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const escapeXml = escapeHtml;
const slugify = value => String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
const routeSlug = (title, duplicateIndex = 1) => {
    const base = slugify(title) || 'yazi';
    return duplicateIndex > 1 ? `${base}-${duplicateIndex}` : base;
};
const assignRoutes = (items, reserved = [], titleForRoute = item => item.title) => {
    const counts = new Map();
    const used = new Set(reserved);
    [...items].sort((a, b) => Number(a.id) - Number(b.id)).forEach(item => {
        const routeTitle = titleForRoute(item);
        const base = slugify(routeTitle) || 'yazi';
        let duplicateIndex = (counts.get(base) || 0) + 1;
        let slug = routeSlug(routeTitle, duplicateIndex);
        while (used.has(slug)) {
            duplicateIndex += 1;
            slug = routeSlug(routeTitle, duplicateIndex);
        }
        counts.set(base, duplicateIndex);
        used.add(slug);
        item.route_slug = slug;
        item.duplicate_index = duplicateIndex;
    });
    return items;
};
const absoluteUrl = relativePath => new URL(relativePath, siteBaseUrl).href;
const sitePath = relativePath => new URL(relativePath, siteBaseUrl).pathname;
const postUrl = post => absoluteUrl(`${post.route_slug}/`);
const postPath = post => sitePath(`${post.route_slug}/`);
const categoryUrl = category => absoluteUrl(`kategori/${category.route_slug}/`);
const categoryPath = category => sitePath(`kategori/${category.route_slug}/`);
const localizeCategory = value => ({
    'about life': 'Yaşam',
    advertising: 'Reklamcılık',
    education: 'Eğitim',
    'science & technology': 'Bilim ve Teknoloji',
    software: 'Yazılım',
    uncategorized: 'Kategorisiz'
})[String(value || '').trim().toLocaleLowerCase('en-US')] || String(value || '').trim();

const sanitizeBody = body => sanitizeHtml(String(body || '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\\"/g, '"'), {
    allowedTags: [
        'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
        'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
        's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
    ],
    allowedAttributes: {
        a: ['href', 'rel', 'target', 'title'],
        '*': ['class'],
        img: ['alt', 'height', 'src', 'title', 'width']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard'
});
const plainText = html => sanitizeHtml(String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:blockquote|div|figcaption|h[1-6]|li|p|td|th|tr)>/gi, ' '), {
    allowedTags: [],
    allowedAttributes: {}
}).replace(/\s+/g, ' ').trim();
const excerpt = (html, length = 155) => {
    const text = plainText(html);
    if (text.length <= length) {
        return text;
    }
    const shortened = text.slice(0, length + 1);
    const boundary = shortened.lastIndexOf(' ');
    return `${shortened.slice(0, boundary > length * 0.7 ? boundary : length).trim()}…`;
};
const readingTime = html => Math.max(1, Math.ceil(plainText(html).split(/\s+/).filter(Boolean).length / 200));
const formatDate = value => new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul'
}).format(new Date(value));
const isoDate = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
};
const jsonForHtml = value => JSON.stringify(value).replace(/</g, '\\u003c');

const readSupabaseConfig = async () => {
    const source = await readFile(join(root, 'assets', 'js', 'supabase-config.js'), 'utf8');
    const url = source.match(/url:\s*'([^']+)'/)?.[1];
    const anonKey = source.match(/anonKey:\s*'([^']+)'/)?.[1];
    if (!url || !anonKey) {
        throw new Error('Supabase configuration could not be read.');
    }
    return { url, anonKey };
};
const fetchJson = async (config, path) => {
    const response = await fetch(new URL(path, config.url), {
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`
        },
        signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
        throw new Error(`Supabase returned ${response.status}.`);
    }
    return response.json();
};
const loadRemoteData = async () => {
    const config = await readSupabaseConfig();
    const [categories, authors, posts] = await Promise.all([
        fetchJson(config, '/rest/v1/categories?select=id,title,description&order=title.asc&limit=500'),
        fetchJson(config, '/rest/v1/authors?select=id,firstname,lastname,avatar&limit=2000'),
        fetchJson(config, `/rest/v1/posts?select=id,title,body,thumbnail,date_time,category_id,author_id,is_featured,is_verified&is_verified=eq.true&order=date_time.desc&limit=${maxPosts}`)
    ]);
    return { categories, authors, posts };
};
const loadFallbackData = async () => {
    const source = await readFile(join(root, 'assets', 'data', 'blog-data.js'), 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { timeout: 5000 });
    return context.window.BLOG_FALLBACK_DATA;
};
const loadData = async () => {
    try {
        return { data: await loadRemoteData(), source: 'Supabase' };
    } catch (error) {
        if (process.env.SEO_REQUIRE_REMOTE === '1') {
            throw error;
        }
        return { data: await loadFallbackData(), source: 'fallback' };
    }
};

const normalizeImage = value => {
    const raw = String(value || '').trim();
    if (!raw) {
        return fallbackAvatar;
    }
    if (/^https:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            const trustedGoogleAvatar = parsed.origin === 'https://lh3.googleusercontent.com'
                && parsed.pathname.startsWith('/a/');
            return parsed.origin === siteOrigin || parsed.hostname.endsWith('.supabase.co') || trustedGoogleAvatar
                ? parsed.href
                : fallbackAvatar;
        } catch {
            return fallbackAvatar;
        }
    }
    if (raw.startsWith('images/')) {
        return absoluteUrl(`assets/${raw}`);
    }
    if (/^[^\\/]+\.(?:png|jpe?g|webp|gif)$/i.test(raw)) {
        return absoluteUrl(`assets/images/${raw}`);
    }
    return fallbackAvatar;
};
const normalizeData = source => {
    const categories = assignRoutes((Array.isArray(source.categories) ? source.categories : [])
        .filter(item => Number.isInteger(Number(item.id)) && String(item.title || '').trim())
        .map(item => ({
            id: Number(item.id),
            title: String(item.title).trim(),
            description: String(item.description || '').trim()
        })), [], category => localizeCategory(category.title));
    const authors = (Array.isArray(source.authors) ? source.authors : [])
        .filter(item => Number.isInteger(Number(item.id)) && String(item.firstname || '').trim())
        .map(item => ({
            id: Number(item.id),
            firstname: String(item.firstname).trim(),
            lastname: String(item.lastname || '').trim(),
            avatar: normalizeImage(item.avatar)
        }));
    const posts = assignRoutes((Array.isArray(source.posts) ? source.posts : [])
        .filter(item => Number.isInteger(Number(item.id)) && item.is_verified !== false && item.is_verified !== 0)
        .map(item => ({
            id: Number(item.id),
            title: String(item.title || '').trim(),
            body: String(item.body || ''),
            thumbnail: normalizeImage(item.thumbnail),
            date_time: isoDate(item.date_time),
            category_id: Number(item.category_id) || null,
            author_id: Number(item.author_id) || null,
            is_featured: item.is_featured === true || item.is_featured === 1
        }))
        .filter(item => item.title && item.body)
        .sort((a, b) => new Date(b.date_time) - new Date(a.date_time)), reservedPostSlugs);
    return { categories, authors, posts };
};

const metadataTags = ({ title, description, canonical, type = 'website', image = '', published = '', section = '' }) => `
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <link rel="alternate" type="application/atom+xml" title="Arda Altunel Blog" href="${escapeHtml(absoluteUrl('feed.xml'))}">
    <meta property="og:locale" content="tr_TR">
    <meta property="og:type" content="${escapeHtml(type)}">
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
    ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}">` : ''}
    ${section ? `<meta property="article:section" content="${escapeHtml(section)}">` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}`;

const scripts = ({ article = false } = {}) => `
<script src="${basePath}assets/vendor/dompurify/purify.min.js"></script>
<script src="${basePath}assets/js/security.js?v=${assetVersion}"></script>
<script src="${basePath}assets/vendor/supabase/supabase.js"></script>
<script src="${basePath}assets/js/supabase-config.js?v=${assetVersion}"></script>
<script src="${basePath}assets/data/blog-data.js?v=${assetVersion}"></script>
<script src="${basePath}assets/js/auth-storage.js?v=${assetVersion}"></script>
<script src="${basePath}assets/js/auth.js?v=${assetVersion}"></script>
${article ? `<script src="${basePath}assets/js/content-enhancements.js?v=${assetVersion}"></script>` : ''}
<script src="${basePath}assets/js/app.js?v=${assetVersion}"></script>
<script src="${basePath}assets/js/main.js?v=${assetVersion}"></script>`;

const navigation = () => `<nav>
    <div class="container nav__container">
        <a href="${basePath}" class="nav__logo">ARDALTUNEL</a>
        <ul class="nav__items"><li><a href="${basePath}signin.html">Giriş yap</a></li></ul>
        <button class="theme__toggle" type="button" aria-label="Temayı değiştir">
            <svg class="ui-icon theme__icon theme__icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg class="ui-icon theme__icon theme__icon--moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
        </button>
        <button id="open__nav-btn" type="button" aria-label="Menüyü aç"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 5h16M4 12h16M4 19h16"/></svg></button>
        <button id="close__nav-btn" type="button" aria-label="Menüyü kapat" hidden><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
</nav>`;

const page = ({ title, description, canonical, type, image, preloadImage = '', published, section, pageName, homePage = 1, previousPage = '', nextPage = '', main, structuredData, article = false, siteVerification = false }) => `<!DOCTYPE html>
<html lang="tr">
<head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
${siteVerification ? '    <meta name="google-site-verification" content="WhMumUYTcsUfTcXBMlek_AFSOMQFO66puERKoP0kpbE" />' : ''}
${metadataTags({ title, description, canonical, type, image, published, section })}
    ${previousPage ? `<link rel="prev" href="${escapeHtml(previousPage)}">` : ''}
    ${nextPage ? `<link rel="next" href="${escapeHtml(nextPage)}">` : ''}
    <link rel="preconnect" href="https://bdadbqlkmdwzzkrwetrf.supabase.co" crossorigin>
    ${preloadImage ? `<link rel="preload" as="image" href="${escapeHtml(preloadImage)}" fetchpriority="high">` : ''}
    <script src="${basePath}assets/js/theme-bootstrap.js?v=${assetVersion}"></script>
    <link rel="apple-touch-icon" href="${basePath}assets/favicon/apple-touch-icon.png">
    <link rel="icon" href="${basePath}assets/favicon/favicon.ico">
    <link rel="stylesheet" href="${basePath}assets/vendor/montserrat/montserrat.css">
<link rel="stylesheet" href="${basePath}assets/css/style.css?v=${assetVersion}">
    <script type="application/ld+json">${jsonForHtml(structuredData)}</script>
</head>
<body data-page="${pageName}" data-prerendered="true"${pageName === 'home' ? ` data-route="home" data-home-page="${homePage}"` : ''}>
${navigation()}
<main id="app">
${main}
</main>
${scripts({ article })}
</body>
</html>
`;

const authorFor = (post, authors) => authors.find(author => author.id === post.author_id) || {
    firstname: 'Arda',
    lastname: 'Altunel',
    avatar: fallbackAvatar
};
const categoryFor = (post, categories) => categories.find(category => category.id === post.category_id);
const renderAuthor = (post, authors) => {
    const author = authorFor(post, authors);
    const name = `${author.firstname} ${author.lastname}`.trim();
    return `<div class="post__author">
                    <div class="post__author-avatar">
                        <img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(name)}" width="46" height="46" decoding="async">
                    </div>
                    <div class="post__author-info">
                        <h5>${escapeHtml(name)}</h5>
                        <small>${escapeHtml(formatDate(post.date_time))}</small>
                    </div>
                </div>`;
};
const renderPostCard = (post, data) => {
    const category = categoryFor(post, data.categories);
    return `<article class="post">
                <a href="${postPath(post)}">
                    <div class="post__thumbnail">
                        <img src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(post.title)}" loading="lazy" decoding="async">
                    </div>
                </a>
                <div class="post__info">
                    <a href="${category ? categoryPath(category) : basePath}" class="category__button">${escapeHtml(localizeCategory(category?.title) || 'Kategorisiz')}</a>
                    <h3 class="post__title"><a href="${postPath(post)}">${escapeHtml(post.title)}</a></h3>
                    <p class="post__body">${escapeHtml(excerpt(post.body, 150))}</p>
                    ${renderAuthor(post, data.authors)}
                </div>
            </article>`;
};
const relatedPostsFor = (post, posts) => {
    const candidates = posts.filter(candidate => candidate.id !== post.id);
    const sameCategory = candidates.filter(candidate => candidate.category_id === post.category_id);
    const otherCategories = candidates.filter(candidate => candidate.category_id !== post.category_id);
    return [...sameCategory, ...otherCategories].slice(0, 3);
};
const renderRelatedPosts = (relatedPosts, data) => {
    if (!relatedPosts.length) {
        return '';
    }
    return `<section class="container related-posts" aria-labelledby="related-posts-title">
            <header class="related-posts__heading">
                <div>
                    <span class="related-posts__eyebrow">OKUMAYA DEVAM ET</span>
                    <h2 id="related-posts-title">Önerilen Yazılar</h2>
                </div>
                <a href="${basePath}#posts" class="related-posts__all">Tüm yazılar <span aria-hidden="true">&rarr;</span></a>
            </header>
            <div class="related-posts__grid">
                ${relatedPosts.map(relatedPost => {
                    const relatedCategory = categoryFor(relatedPost, data.categories);
                    const relatedHref = postPath(relatedPost);
                    return `<article class="related-post">
                        <a href="${relatedHref}" class="related-post__thumbnail">
                            <img src="${escapeHtml(relatedPost.thumbnail)}" alt="${escapeHtml(relatedPost.title)}" loading="lazy" decoding="async">
                            <span class="related-post__category">${escapeHtml(localizeCategory(relatedCategory?.title) || 'Kategorisiz')}</span>
                        </a>
                        <div class="related-post__content">
                            <h3><a href="${relatedHref}">${escapeHtml(relatedPost.title)}</a></h3>
                            <p>${escapeHtml(excerpt(relatedPost.body, 105))}</p>
                            <a href="${relatedHref}" class="related-post__meta" aria-label="${escapeHtml(`${relatedPost.title} yazısını oku`)}">
                                <span>${readingTime(relatedPost.body)} dk okuma</span>
                                <span aria-hidden="true">&rarr;</span>
                            </a>
                        </div>
                    </article>`;
                }).join('')}
            </div>
        </section>`;
};
const renderCategoryButtons = categories => `<section class="category__buttons">
            <div class="container category__buttons-container">
                ${categories.map(category => `<a href="${categoryPath(category)}" class="category__button">${escapeHtml(localizeCategory(category.title))}</a>`).join('')}
            </div>
        </section>`;

const homePagePath = pageNumber => pageNumber > 1 ? `${basePath}${pageNumber}/` : basePath;
const homePageUrl = pageNumber => new URL(homePagePath(pageNumber), siteOrigin).href;
const homePageCount = data => Math.max(1, Math.ceil(data.posts.length / postsPerPage));
const renderPagination = (currentPage, totalPages) => {
    if (totalPages <= 1) {
        return '';
    }

    const versionedPage = pageNumber => `${homePagePath(pageNumber)}?v=${assetVersion}`;
    return `<div class="container pagination__container" role="navigation" aria-label="Blog sayfaları">
                ${currentPage > 1 ? `<a href="${versionedPage(currentPage - 1)}" rel="prev" class="pagination__button pagination__button--previous" aria-label="Önceki sayfaya git">
                    <span class="pagination__icon" aria-hidden="true">&larr;</span>
                    <span>Önceki <span class="pagination__label-suffix">sayfa</span></span>
                </a>` : ''}
                <span class="pagination__status" aria-current="page" aria-label="${currentPage}. sayfa, toplam ${totalPages} sayfa">${currentPage} / ${totalPages}</span>
                ${currentPage < totalPages ? `<a href="${versionedPage(currentPage + 1)}" rel="next" class="pagination__button pagination__button--next" aria-label="Sonraki sayfaya git">
                    <span>Sonraki <span class="pagination__label-suffix">sayfa</span></span>
                    <span class="pagination__icon" aria-hidden="true">&rarr;</span>
                </a>` : ''}
            </div>`;
};

const renderLegacyPaginationRedirect = pageNumber => {
    const destinationPath = homePagePath(pageNumber);
    const destinationUrl = homePageUrl(pageNumber);
    return `<!doctype html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,follow">
    <link rel="canonical" href="${destinationUrl}">
    <meta http-equiv="refresh" content="0;url=${destinationPath}">
    <title>Blog sayfasına yönlendiriliyor</title>
</head>
<body>
    <p><a href="${destinationPath}">${pageNumber}. blog sayfasına devam et</a></p>
</body>
</html>`;
};

const renderHome = (data, requestedPage = 1) => {
    const totalPages = homePageCount(data);
    const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
    const offset = (currentPage - 1) * postsPerPage;
    const posts = data.posts.slice(offset, offset + postsPerPage);
    const featured = currentPage === 1 ? data.posts.find(post => post.is_featured) : null;
    const featuredCategory = featured ? categoryFor(featured, data.categories) : null;
    const main = `${featured ? `<section class="featured">
            <div class="container featured__container">
                <a href="${postPath(featured)}">
                    <div class="post__thumbnail">
                        <img src="${escapeHtml(featured.thumbnail)}" alt="${escapeHtml(featured.title)}" decoding="async" fetchpriority="high">
                    </div>
                </a>
                <div class="post__info">
                    <a href="${featuredCategory ? categoryPath(featuredCategory) : basePath}" class="category__button">${escapeHtml(localizeCategory(featuredCategory?.title) || 'Kategorisiz')}</a>
                    <h2 class="post__title"><a href="${postPath(featured)}">${escapeHtml(featured.title)}</a></h2>
                    <p class="post__body">${escapeHtml(excerpt(featured.body, 300))}</p>
                    ${renderAuthor(featured, data.authors)}
                </div>
            </div>
        </section>` : ''}
        <section class="posts ${featured ? '' : 'section__extra-margin'}" id="posts">
            <div class="pagination__loading" role="status" aria-live="polite" aria-label="Yazılar yükleniyor">
                <span class="pagination__loading-spinner" aria-hidden="true"></span>
                <span class="pagination__loading-copy"><span class="pagination__loading-title">Yazılar yükleniyor...</span><small>Gönderiler hazırlanıyor</small></span>
            </div>
            <div class="container posts__container">${posts.map(post => renderPostCard(post, data)).join('')}</div>
            ${renderPagination(currentPage, totalPages)}
        </section>
        ${renderCategoryButtons(data.categories)}`;
    const newest = data.posts[0];
    const canonical = homePageUrl(currentPage);
    const title = currentPage > 1 ? `Blog Yazıları – Sayfa ${currentPage} | Arda Altunel` : 'Blog Yazıları | Arda Altunel';
    return page({
        title,
        description: homeDescription,
        canonical,
        type: 'website',
        image: newest?.thumbnail || logoUrl,
        preloadImage: featured?.thumbnail || posts[0]?.thumbnail || newest?.thumbnail || '',
        pageName: 'home',
        homePage: currentPage,
        previousPage: currentPage > 1 ? homePageUrl(currentPage - 1) : '',
        nextPage: currentPage < totalPages ? homePageUrl(currentPage + 1) : '',
        siteVerification: true,
        main,
        structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Blog',
                    '@id': `${siteBaseUrl}#blog`,
                    name: 'Arda Altunel Blog',
                    url: siteBaseUrl,
                    description: homeDescription,
                    inLanguage: 'tr-TR',
                    publisher: {
                        '@type': 'Person',
                        name: 'Arda Altunel'
                    }
                },
                {
                    '@type': 'ItemList',
                    itemListElement: posts.map((post, index) => ({
                        '@type': 'ListItem',
                        position: offset + index + 1,
                        url: postUrl(post),
                        name: post.title
                    }))
                }
            ]
        }
    });
};

const renderPost = (post, index, data) => {
    const previousPost = data.posts[index + 1] || data.posts[0];
    const nextPost = data.posts[index - 1] || data.posts.at(-1);
    const relatedPosts = relatedPostsFor(post, data.posts);
    const category = categoryFor(post, data.categories);
    const author = authorFor(post, data.authors);
    const authorName = `${author.firstname} ${author.lastname}`.trim();
    const description = excerpt(post.body);
    const canonical = postUrl(post);
    const main = `<section class="singlepost">
        <article class="container singlepost__container">
            <div class="singlepost__hero">
                <figure class="singlepost__thumbnail">
                    <img src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(post.title)}" decoding="async" fetchpriority="high">
                </figure>
                <div class="singlepost__hero-shade"></div>
                <header class="singlepost__header">
                    <div class="singlepost__eyebrow">
                        <a href="${category ? categoryPath(category) : basePath}" class="category__button">${escapeHtml(localizeCategory(category?.title) || 'Genel')}</a>
                        <span>${readingTime(post.body)} dk okuma</span>
                    </div>
                    <h1>${escapeHtml(post.title)}</h1>
                    ${renderAuthor(post, data.authors)}
                </header>
            </div>
            <div class="singlepost__body">
                <div id="post-content" class="article-content">${sanitizeBody(post.body)}</div>
                <div class="singlepost__buttons">
                    <a href="${postPath(previousPost)}" class="singlepost__previous">
                        <div class="singlepost__button-label">ÖNCEKİ YAZI</div>
                        <div>${escapeHtml(previousPost.title)}</div>
                    </a>
                    <a href="${postPath(nextPost)}" class="singlepost__next">
                        <div class="singlepost__button-label">SONRAKİ YAZI</div>
                        <div>${escapeHtml(nextPost.title)}</div>
                    </a>
                </div>
            </div>
        </article>
        ${renderRelatedPosts(relatedPosts, data)}
    </section>`;
    return page({
        title: `${post.title} | Arda Altunel`,
        description,
        canonical,
        type: 'article',
        image: post.thumbnail,
        preloadImage: post.thumbnail,
        published: post.date_time,
        section: localizeCategory(category?.title),
        pageName: 'post',
        main,
        article: true,
        structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'BlogPosting',
                    '@id': `${canonical}#article`,
                    mainEntityOfPage: canonical,
                    headline: post.title,
                    description,
                    image: [post.thumbnail],
                    datePublished: post.date_time,
                    dateModified: post.date_time,
                    inLanguage: 'tr-TR',
                    articleSection: localizeCategory(category?.title) || 'Genel',
                    author: {
                        '@type': 'Person',
                        name: authorName
                    },
                    publisher: {
                        '@type': 'Person',
                        name: 'Arda Altunel'
                    }
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: 'Blog',
                            item: siteBaseUrl
                        },
                        ...(category ? [{
                            '@type': 'ListItem',
                            position: 2,
                            name: localizeCategory(category.title),
                            item: categoryUrl(category)
                        }] : []),
                        {
                            '@type': 'ListItem',
                            position: category ? 3 : 2,
                            name: post.title,
                            item: canonical
                        }
                    ]
                },
                ...(relatedPosts.length ? [{
                    '@type': 'ItemList',
                    name: 'Önerilen Yazılar',
                    itemListElement: relatedPosts.map((relatedPost, relatedIndex) => ({
                        '@type': 'ListItem',
                        position: relatedIndex + 1,
                        url: postUrl(relatedPost),
                        name: relatedPost.title
                    }))
                }] : [])
            ]
        }
    });
};

const renderCategory = (category, data) => {
    const posts = data.posts.filter(post => post.category_id === category.id);
    const title = `${localizeCategory(category.title)} Yazıları | Arda Altunel`;
    const description = category.description || `${localizeCategory(category.title)} kategorisindeki blog yazıları.`;
    const canonical = categoryUrl(category);
    const main = `<header class="category__title"><h2>${escapeHtml(localizeCategory(category.title))}</h2></header>
        ${posts.length ? `<section class="posts">
            <div class="container posts__container">${posts.map(post => renderPostCard(post, data)).join('')}</div>
        </section>` : '<div class="alert__message error lg"><p>Bu kategoride henüz yazı bulunmuyor.</p></div>'}
        ${renderCategoryButtons(data.categories)}`;
    return page({
        title,
        description,
        canonical,
        type: 'website',
        image: posts[0]?.thumbnail || logoUrl,
        pageName: 'category',
        main,
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url: canonical,
            inLanguage: 'tr-TR',
            isPartOf: {
                '@type': 'Blog',
                name: 'Arda Altunel Blog',
                url: siteBaseUrl
            }
        }
    });
};

const sitemapXml = data => {
    const newestDate = data.posts[0]?.date_time || new Date().toISOString();
    const entries = [
        { loc: siteBaseUrl, lastmod: newestDate, image: data.posts[0]?.thumbnail },
        ...Array.from({ length: Math.max(0, homePageCount(data) - 1) }, (_, index) => ({
            loc: homePageUrl(index + 2),
            lastmod: newestDate,
            image: data.posts[(index + 1) * postsPerPage]?.thumbnail
        })),
        ...data.categories.map(category => {
            const latest = data.posts.find(post => post.category_id === category.id);
            return {
                loc: categoryUrl(category),
                lastmod: latest?.date_time || newestDate,
                image: latest?.thumbnail
            };
        }),
        ...data.posts.map(post => ({ loc: postUrl(post), lastmod: post.date_time, image: post.thumbnail }))
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map(entry => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(isoDate(entry.lastmod))}</lastmod>
${entry.image ? `    <image:image><image:loc>${escapeXml(entry.image)}</image:loc></image:image>\n` : ''}  </url>`).join('\n')}
</urlset>
`;
};

const atomFeed = data => {
    const posts = data.posts.slice(0, 20);
    const updated = posts[0]?.date_time || new Date().toISOString();
    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="tr">
  <title>Arda Altunel Blog</title>
  <id>${escapeXml(siteBaseUrl)}</id>
  <link href="${escapeXml(siteBaseUrl)}"/>
  <link href="${escapeXml(absoluteUrl('feed.xml'))}" rel="self" type="application/atom+xml"/>
  <updated>${escapeXml(updated)}</updated>
  ${posts.map(post => {
        const author = authorFor(post, data.authors);
        return `<entry>
    <title>${escapeXml(post.title)}</title>
    <id>${escapeXml(postUrl(post))}</id>
    <link href="${escapeXml(postUrl(post))}"/>
    <updated>${escapeXml(post.date_time)}</updated>
    <published>${escapeXml(post.date_time)}</published>
    <author><name>${escapeXml(`${author.firstname} ${author.lastname}`.trim())}</name></author>
    <summary type="text">${escapeXml(excerpt(post.body, 300))}</summary>
  </entry>`;
    }).join('\n  ')}
</feed>
`;
};

const robotsTxt = `User-agent: *
Allow: ${basePath}
Disallow: ${basePath}admin.html
Disallow: ${basePath}add-post.html
Disallow: ${basePath}signin.html
Disallow: ${basePath}signup.html
Disallow: ${basePath}yeni-blog-ekle/

Sitemap: ${absoluteUrl('sitemap.xml')}
`;

const copySiteAssets = async () => {
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const entry of [
        '.nojekyll',
        '404.html',
        'add-post.html',
        'admin.html',
        'assets',
        'category.html',
        'index.html',
        'post.html',
        'privacy.html',
        'signin.html',
        'signup.html',
        'yeni-blog-ekle'
    ]) {
        await cp(join(root, entry), join(output, entry), { recursive: true });
    }
};
const writePage = async (relativePath, content) => {
    const destination = join(output, relativePath);
    const resolved = resolve(destination);
    if (resolved !== output && !resolved.startsWith(`${output}${sep}`)) {
        throw new Error(`Unsafe generated path: ${relativePath}`);
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, 'utf8');
};

const { data: rawData, source } = await loadData();
const data = normalizeData(rawData);
if (!data.posts.length) {
    throw new Error('No verified posts were available for the SEO build.');
}

await copySiteAssets();
await writePage(
    join('assets', 'data', 'blog-data.js'),
    `window.BLOG_FALLBACK_DATA = ${jsonForHtml(data)};\n`
);
const totalHomePages = homePageCount(data);
await writePage('index.html', renderHome(data, 1));
for (let pageNumber = 2; pageNumber <= totalHomePages; pageNumber += 1) {
    await writePage(join(String(pageNumber), 'index.html'), renderHome(data, pageNumber));
    await writePage(join('sayfa', String(pageNumber), 'index.html'), renderLegacyPaginationRedirect(pageNumber));
}
for (const [index, post] of data.posts.entries()) {
    await writePage(join(post.route_slug, 'index.html'), renderPost(post, index, data));
}
for (const category of data.categories) {
    await writePage(join('kategori', category.route_slug, 'index.html'), renderCategory(category, data));
}
await writePage('sitemap.xml', sitemapXml(data));
await writePage('feed.xml', atomFeed(data));
await writePage('robots.txt', robotsTxt);

process.stdout.write(`SEO build created ${data.posts.length} post pages, ${data.categories.length} category pages and ${totalHomePages} blog index pages from ${source}.\n`);
