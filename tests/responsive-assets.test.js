const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const ROOT = join(__dirname, '..');
const RELEASE_VERSION = '72';
const HTML_FILES = [
    '404.html',
    'add-post.html',
    'admin.html',
    'category.html',
    'index.html',
    'post.html',
    'privacy.html',
    'signin.html',
    'signup.html',
    join('yeni-blog-ekle', 'index.html')
];

test('keeps every page viewport-aware and first-party assets cache-safe', () => {
    for (const file of HTML_FILES) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0">/i, `${file} needs a responsive viewport`);
        assert.match(html, /img-src\s+'self'\s+blob:/i, `${file} must allow local image previews`);
        assert.doesNotMatch(html, /default-src[^;]*blob:/i, `${file} must limit blob URLs to images`);
        assert.match(html, /rel="preconnect" href="https:\/\/bdadbqlkmdwzzkrwetrf\.supabase\.co" crossorigin/i, `${file} must warm the content origin`);
        assert.match(html, /<ul class="nav__items"><li><a href="\/blog\/signin\.html">Giriş yap<\/a><\/li><\/ul>/i, `${file} must render the anonymous header immediately`);
        assert.match(html, /<svg class="ui-icon theme__icon theme__icon--sun"/i, `${file} must inline its critical theme icon`);

        const assetReferences = [...html.matchAll(/(?:src|href)="[^"]*assets\/(?:css|js|data)\/[^\"]+"/g)];
        assert.ok(assetReferences.length > 0, `${file} needs versioned first-party assets`);
        for (const [reference] of assetReferences) {
            assert.ok(reference.endsWith(`?v=${RELEASE_VERSION}"`), `${file} contains an unversioned or stale asset`);
        }
    }
});

test('keeps the critical responsive breakpoints and overflow safeguards', () => {
    const css = readFileSync(join(ROOT, 'assets', 'css', 'style.css'), 'utf8');
    const breakpoints = new Map([
        ['1024px', /@media\s+screen\s+and\s+\(max-width:\s*1024px\)/],
        ['900px', /@media\s+screen\s+and\s+\(max-width:\s*900px\)/],
        ['640px', /@media\s+screen\s+and\s+\(max-width:\s*640px\)/],
        ['360px', /@media\s+screen\s+and\s+\(max-width:\s*360px\)/]
    ]);
    for (const [width, pattern] of breakpoints) {
        assert.match(css, pattern, `Missing ${width} breakpoint`);
    }
    assert.match(css, /nav\s*\{[^}]*width:\s*100%;/s);
    assert.match(css, /\.article-content table\s*\{[^}]*overflow-x:\s*auto;/s);
    assert.match(css, /input\[type="file"\]\s*\{[^}]*max-width:\s*100%;/s);
    assert.match(css, /\.dashboard main \.dashboard__table--posts td\s*\{[^}]*min-height:\s*0;/s);
    assert.match(css, /\.dashboard main \.dashboard__table--admin-posts \.dashboard__post-action\s*\{[^}]*grid-column:\s*span 2;/s);
    assert.match(css, /\.dashboard main \.dashboard__table--posts \.dashboard__publish-control\s*\{[^}]*min-height:\s*2\.5rem;[^}]*border-radius:\s*10px;/s);
    assert.match(css, /\.dashboard main \.dashboard__table--posts \.dashboard__publish-switch\s*\{[^}]*width:\s*3rem;[^}]*height:\s*1\.65rem;/s);
    assert.match(css, /\.image-upload-preview\s*\{[^}]*grid-template-columns:\s*minmax\(7\.5rem, 10rem\) minmax\(0, 1fr\);/s);
    assert.match(css, /\.image-upload-preview img\s*\{[^}]*aspect-ratio:\s*16 \/ 9;[^}]*object-fit:\s*cover;/s);
});

test('keeps generated pages and local clean routes on the current assets', () => {
    const builder = readFileSync(join(ROOT, 'scripts', 'build-pages.mjs'), 'utf8');
    const server = readFileSync(join(ROOT, 'scripts', 'serve.mjs'), 'utf8');

    assert.match(builder, /const assetVersion = '72';/);
    assert.match(builder, /img-src 'self' blob:/);
    assert.match(builder, /data-prerendered="true"/);
    assert.match(builder, /rel="preload" as="image"/);
    assert.match(builder, /style\.css\?v=\$\{assetVersion\}/);
    assert.match(builder, /app\.js\?v=\$\{assetVersion\}/);
    assert.match(server, /pathname\.startsWith\('\/blog\/'\)/);
    assert.match(server, /'Cache-Control': 'no-store, max-age=0'/);
});

test('preserves and normalizes the home pagination query', () => {
    const main = readFileSync(join(ROOT, 'assets', 'js', 'main.js'), 'utf8');
    const app = readFileSync(join(ROOT, 'assets', 'js', 'app.js'), 'utf8');
    const builder = readFileSync(join(ROOT, 'scripts', 'build-pages.mjs'), 'utf8');

    assert.match(main, /canonicalRoute === 'home' \? security\.getQueryParam\('page'\) : null/);
    assert.match(main, /security\.buildRoute\(canonicalRoute, canonicalValues\)/);
    assert.match(app, /const requestedHomePage = pageName === 'home' \? security\?\.getQueryParam\('page'\) : null/);
    assert.match(app, /const PAGINATION_CACHE_VERSION = '72';/);
    assert.match(app, /route\.includes\('\?'\) \? '&' : '\?'/);
    assert.match(app, /security\.buildRoute\('home', safePage > 1 \? \{ page: safePage \} : \{\}\)/);
    assert.match(app, /window\.history\.replaceState\(null, '', `\$\{homeUrl\.pathname\}\$\{homeUrl\.search\}/);
    assert.match(app, /document\.querySelector\('#posts'\)\?\.scrollIntoView\(\{ block: 'start' \}\)/);
    assert.match(app, /paginationRevealTimer = null;\s*scrollToRequestedPosts\(\);/);
    assert.match(builder, /pageName === 'home' \? ' data-route="home"' : ''/);
    assert.match(app, /if \(isPrerendered && window\.BLOG_FALLBACK_DATA\)/);
    assert.match(app, /postColumns = routeFallback[\s\S]*id,title,thumbnail,date_time,category_id,author_id,is_featured,is_verified/);
    assert.match(app, /\.in\('id', \[\.\.\.requiredPosts\]\)/);

    const notFound = readFileSync(join(ROOT, '404.html'), 'utf8');
    const initialMain = notFound.match(/<main id="app">([\s\S]*?)<\/main>/)?.[1] || '';
    assert.match(initialMain, /class="route-loading"/);
    assert.doesNotMatch(initialMain, /not-found__code|ROTA BULUNAMADI/);
});

test('keeps rich editor fields out of hidden native validation', () => {
    const editor = readFileSync(join(ROOT, 'assets', 'js', 'rich-editor.js'), 'utf8');
    const authPages = readFileSync(join(ROOT, 'assets', 'js', 'auth-pages.js'), 'utf8');

    assert.match(editor, /const wasRequired = textarea\.required;\s*textarea\.required = false;\s*textarea\.hidden = true;/);
    assert.match(editor, /wrapper\.remove\(\);\s*textarea\.required = wasRequired;\s*textarea\.hidden = false;/);
    assert.match(editor, /const syncTextarea = \(\) => \{\s*textarea\.value = serializeChildren\(editable\);/);
    assert.match(editor, /editable\.addEventListener\('input', \(\) => \{\s*syncTextarea\(\);\s*updateCounter\(\);/);
    assert.match(editor, /const getData = \(\) => \{\s*const sanitized = global\.SecurityUtils\.sanitizeBlogHtml\(syncTextarea\(\)\);\s*textarea\.value = sanitized;/);
    assert.match(authPages, /if \(!body\) \{\s*showMessage\('Yazı içeriği zorunludur\.'\);\s*document\.querySelector\('\.safe-editor__editable'\)\?\.focus\(\);/);
    assert.match(authPages, /const candidates = \[\];[\s\S]*candidates\.push\(String\(fallback \|\| ''\)\);/);
    assert.match(authPages, /if \(!updatedBody\) \{\s*showEditPostMessage\('Yazı içeriği zorunludur\.'\);\s*editPostPanel\.querySelector\('\.safe-editor__editable'\)\?\.focus\(\);/);
    assert.match(authPages, /const form = event\.currentTarget;\s*const title = readTitle\(form\.querySelector\('#edit-post-title'\)\?\.value\);\s*const updatedBody = getBody\(editPostEditor, form\.querySelector\('#edit-editor'\)\?\.value\);\s*const updatedCategoryId = safeId\(form\.querySelector\('#edit-post-category'\)\?\.value\);/);
    assert.doesNotMatch(authPages, /new FormData\(event\.currentTarget\);\s*const title = readTitle\(formData\.get\('title'\)\);/);
    assert.match(authPages, /client\.from\('posts'\)\.select\('id,title,body,thumbnail,category_id'\)/);
    assert.match(authPages, /const thumbnailFile = form\.querySelector\('#edit-post-thumbnail'\)\?\.files\?\.\[0\] \|\| null;/);
    assert.match(authPages, /updates\.thumbnail = upload\.publicUrl;/);
    assert.match(authPages, /const oldThumbnailPath = storagePathFromPublicUrl\(thumbnail\);/);
    assert.match(authPages, /const setupImagePreview = \(input, preview,/);

    for (const file of ['add-post.html', join('yeni-blog-ekle', 'index.html')]) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        const form = html.match(/<form id="add-post-form">([\s\S]*?)<\/form>/)?.[1] || '';
        assert.match(form, /id="auth-message"/i, `${file} should show submission feedback beside the submit action`);
        assert.ok(form.indexOf('id="auth-message"') < form.indexOf('İncelemeye gönder'), `${file} should show feedback before the submit action`);
        assert.match(form, /id="thumbnail-preview" hidden/, `${file} should include a cover image preview`);
        assert.match(form, /class="image-upload-preview__label"/, `${file} should label the selected cover preview`);
    }
});
