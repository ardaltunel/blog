const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

global.SUPABASE_CONFIG = {
    url: 'https://project-ref.supabase.co',
    anonKey: 'sb_publishable_test_key',
    storageBucket: 'blog-images'
};

const security = require('../assets/js/security.js');

test('uses a neutral placeholder when an avatar is missing', () => {
    assert.match(security.DEFAULT_AVATAR, /\/assets\/images\/no-user-photo\.svg\?v=2$/);
    assert.equal(security.safeImageUrl(''), security.safeImageUrl(security.DEFAULT_AVATAR));
});

test('uses the GitHub Pages project root for clean routes and local assets in browsers', () => {
    const window = {
        document: {
            currentScript: {
                src: 'https://ardaltunel.github.io/blog/assets/js/security.js?v=16'
            }
        },
        location: {
            href: 'https://ardaltunel.github.io/blog/ornek-yazi/',
            pathname: '/blog/ornek-yazi/',
            search: ''
        },
        SUPABASE_CONFIG: global.SUPABASE_CONFIG
    };
    const context = vm.createContext({
        URL,
        URLSearchParams,
        window
    });
    const source = readFileSync(require.resolve('../assets/js/security.js'), 'utf8');
    vm.runInContext(source, context);

    assert.equal(
        window.SecurityUtils.buildRoute('post', { id: 1, title: 'Örnek Yazı' }),
        '/blog/ornek-yazi/'
    );
    assert.equal(
        window.SecurityUtils.buildRoute('post', { id: 2, title: 'Örnek Yazı', duplicateIndex: 2 }),
        '/blog/ornek-yazi-2/'
    );
    assert.equal(window.SecurityUtils.buildRoute('home'), '/blog/');
    assert.equal(window.SecurityUtils.buildRoute('addPost'), '/blog/yeni-blog-ekle/');
    assert.equal(
        window.SecurityUtils.buildRoute('category', { id: 4, title: 'Yazılım' }),
        '/blog/kategori/yazilim/'
    );
    assert.equal(
        window.SecurityUtils.safeImageUrl('1675861781yazilim.jpg', ''),
        'https://ardaltunel.github.io/blog/assets/images/1675861781yazilim.jpg'
    );
});

test('uses dynamic post and category pages on local development servers', () => {
    const window = {
        document: {
            currentScript: {
                src: 'http://127.0.0.1:5500/assets/js/security.js?v=21'
            }
        },
        location: {
            href: 'http://127.0.0.1:5500/index.html',
            pathname: '/index.html',
            search: ''
        },
        SUPABASE_CONFIG: global.SUPABASE_CONFIG
    };
    const context = vm.createContext({
        URL,
        URLSearchParams,
        window
    });
    const source = readFileSync(require.resolve('../assets/js/security.js'), 'utf8');
    vm.runInContext(source, context);

    assert.equal(
        window.SecurityUtils.buildRoute('post', { id: 1, title: 'Dijital Dönüşümde Tasarımın Rolü' }),
        '/post.html?id=1'
    );
    assert.equal(
        window.SecurityUtils.buildRoute('category', { id: 4, title: 'Yazılım' }),
        '/category.html?id=4'
    );
});

test('localizes built-in category titles without changing custom categories', () => {
    assert.equal(security.localizeCategoryTitle('Science & Technology'), 'Bilim ve Teknoloji');
    assert.equal(security.localizeCategoryTitle('software'), 'Yazılım');
    assert.equal(security.localizeCategoryTitle('Özel Kategori'), 'Özel Kategori');
});

test('accepts only canonical positive post IDs', () => {
    assert.equal(security.getQueryParam('id', '?id=122'), 122);
    const rejected = [
        '?id=',
        '?id=0',
        '?id=-1',
        '?id=1.5',
        '?id=122abc',
        '?id=abc',
        '?id=<script>alert(1)</script>',
        '?id=%3Cimg%20src=x%20onerror=alert(1)%3E',
        '?id=javascript:alert(1)',
        '?id=../../etc/passwd',
        '?id=..%2F..%2F',
        '?id=999999999999999999999999',
        '?id[]=1',
        '?id=%00',
        '?id=1&id=2'
    ];
    rejected.forEach(search => assert.equal(security.getQueryParam('id', search), null, search));
});

test('validates page and dashboard view parameters by schema', () => {
    assert.equal(security.getQueryParam('page', '?page=2'), 2);
    assert.equal(security.getQueryParam('page', '?page=2abc'), null);
    assert.equal(security.getQueryParam('page', '?page=100001'), null);
    assert.equal(security.getQueryParam('view', '?view=manage-users'), 'manage-users');
    assert.equal(security.getQueryParam('view', '?view=profile'), 'profile');
    assert.equal(security.getQueryParam('view', '?view=__proto__'), null);
    assert.equal(security.getQueryParam('redirect', '?redirect=./admin.html'), null);
});

test('allows members to open their profile while keeping admin views protected', () => {
    assert.equal(security.resolveDashboardView('profile', false), 'profile');
    assert.equal(security.resolveDashboardView('my-posts', false), 'my-posts');
    assert.equal(security.resolveDashboardView('manage-users', false), 'my-posts');
    assert.equal(security.resolveDashboardView('manage-users', true), 'manage-users');
    assert.equal(security.resolveDashboardView('invalid-view', true), 'my-posts');
});

test('keeps the dashboard and privileged links hidden until authorization resolves', () => {
    const adminHtml = readFileSync(require.resolve('../admin.html'), 'utf8');
    assert.match(adminHtml, /<section\b[^>]*id="dashboard-shell"[^>]*\bhidden\b[^>]*>/);
    assert.match(adminHtml, /<div\b[^>]*id="dashboard-loading"[^>]*>/);

    const privilegedLinks = adminHtml.match(/<a\b[^>]*data-admin-only[^>]*>/g) || [];
    assert.equal(privilegedLinks.length, 5);
    privilegedLinks.forEach(link => assert.match(link, /\bhidden\b/));
});

test('keeps the Google avatar action visible in the profile photo card', () => {
    const authPagesSource = readFileSync(require.resolve('../assets/js/auth-pages.js'), 'utf8');
    const stylesheetSource = readFileSync(require.resolve('../assets/css/style.css'), 'utf8');
    assert.match(authPagesSource, /id="use-google-avatar"/);
    assert.doesNotMatch(authPagesSource, /const googleAvatarAction = googleAvatar \?/);
    assert.match(authPagesSource, /auth\.signInWithOAuth\(\{[\s\S]*?provider: 'google'/);
    assert.match(stylesheetSource, /\.dashboard__google-avatar-button\s*\{[\s\S]*?height:\s*2\.45rem;[\s\S]*?padding:\s*0 1rem;/);
    assert.match(stylesheetSource, /\.dashboard__settings-card--avatar \.dashboard__avatar-actions \.btn\s*\{\s*margin-top:\s*0;/);
});

test('shows a clear empty state when the current user has no posts', () => {
    const authPagesSource = readFileSync(require.resolve('../assets/js/auth-pages.js'), 'utf8');
    assert.match(authPagesSource, /posts\.length === 0/);
    assert.match(authPagesSource, /Henüz bir yazı yazmadınız\./);
    assert.match(authPagesSource, /dashboard__empty-posts/);
});

test('builds routes only from the fixed route and parameter allowlists', () => {
    assert.equal(
        security.buildRoute('post', { id: 122, title: 'Dijital Dönüşümde Tasarımın Rolü' }),
        './dijital-donusumde-tasarimin-rolu/'
    );
    assert.equal(
        security.buildRoute('post', {
            id: 123,
            title: 'Dijital Dönüşümde Tasarımın Rolü',
            duplicateIndex: 2
        }),
        './dijital-donusumde-tasarimin-rolu-2/'
    );
    assert.equal(security.buildRoute('post', { id: '122abc' }), './');
    assert.equal(security.buildRoute('admin', { view: 'manage-users' }), './admin.html?view=manage-users');
    assert.equal(security.buildRoute('admin', { view: 'https://evil.example' }), './admin.html');
    assert.equal(security.buildRoute('https://evil.example'), './');
});

test('creates Turkish-safe post slugs and reads clean and legacy post paths', () => {
    assert.equal(security.createSlug('  Çığ, ŞÖLEN ve Ürün!  '), 'cig-solen-ve-urun');
    assert.equal(security.createPostSlug('Dijital Dönüşümde Tasarımın Rolü'), 'dijital-donusumde-tasarimin-rolu');
    assert.equal(security.createPostSlug('Dijital Dönüşümde Tasarımın Rolü', 2), 'dijital-donusumde-tasarimin-rolu-2');
    assert.equal(security.getPostSlug('/blog/dijital-donusumde-tasarimin-rolu/'), 'dijital-donusumde-tasarimin-rolu');
    assert.equal(security.getPostSlug('/blog/dijital-donusumde-tasarimin-rolu-2/'), 'dijital-donusumde-tasarimin-rolu-2');
    assert.equal(security.getPostSlug('/blog/kategori/yazilim/'), null);
    assert.equal(security.createCategorySlug('Bilim ve Teknoloji'), 'bilim-ve-teknoloji');
    assert.equal(security.getCategorySlug('/blog/kategori/bilim-ve-teknoloji/'), 'bilim-ve-teknoloji');
    assert.equal(
        security.getPostId('', '/blog/yazi/dijital-donusumde-tasarimin-rolu-122/'),
        122
    );
    assert.equal(security.getPostId('?id=122', '/blog/post.html'), 122);
    assert.equal(security.getPostId('', '/blog/yazi/gecersiz/'), null);
    assert.equal(security.getPostId('', '/blog/yazi/yazi-0/'), null);
    assert.equal(security.getPostId('', '/blog/yazi/yazi-9999999999/'), null);
});

test('rejects open redirect and dangerous protocol candidates', () => {
    const base = 'https://ardaltunel.github.io/blog/index.html';
    assert.equal(security.safeInternalPath('./post.html?id=122', base), './post.html?id=122');
    assert.equal(security.safeInternalPath('./admin.html?view=manage-users', base), './admin.html?view=manage-users');
    [
        'https://evil.example',
        '//evil.example',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        './post.html?id=122abc',
        './admin.html?view=__proto__',
        '../../etc/passwd'
    ].forEach(value => assert.equal(security.safeInternalPath(value, base), null, value));

    [
        '?redirect=https://evil.example',
        '?redirect=//evil.example',
        '?redirect=javascript:alert(1)',
        '?url=data:text/html,<script>alert(1)</script>',
        '?search=<svg onload=alert(1)>'
    ].forEach(search => {
        const name = new URLSearchParams(search).keys().next().value;
        assert.equal(security.getQueryParam(name, search), null, search);
    });
});

test('allows HTTPS content links but blocks active and ambiguous schemes', () => {
    const base = 'https://ardaltunel.github.io/blog/post.html?id=122';
    assert.equal(security.safeContentUrl('https://example.com/article', base), 'https://example.com/article');
    assert.equal(security.safeContentUrl('./category.html?id=1', base), 'https://ardaltunel.github.io/blog/category.html?id=1');
    ['javascript:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)', 'file:///etc/passwd', '//evil.example']
        .forEach(value => assert.equal(security.safeContentUrl(value, base), null, value));
});

test('accepts supported YouTube URLs and creates privacy-enhanced embed URLs', () => {
    const base = 'https://ardaltunel.github.io/blog/post.html?id=122';
    assert.deepEqual(
        security.parseYouTubeUrl('https://www.youtube.com/watch?v=F7a0lp0cEyY&t=1m30s', base),
        {
            id: 'F7a0lp0cEyY',
            start: 90,
            watchUrl: 'https://www.youtube.com/watch?v=F7a0lp0cEyY&t=90s',
            embedUrl: 'https://www.youtube-nocookie.com/embed/F7a0lp0cEyY?rel=0&start=90'
        }
    );
    assert.equal(
        security.parseYouTubeUrl('youtu.be/78BwmqRsU8A?start=42', base)?.embedUrl,
        'https://www.youtube-nocookie.com/embed/78BwmqRsU8A?rel=0&start=42'
    );
    assert.equal(
        security.parseYouTubeUrl('https://youtube.com/shorts/LuHd-cdKX_s', base)?.id,
        'LuHd-cdKX_s'
    );
    [
        'https://youtube.example/watch?v=F7a0lp0cEyY',
        'https://www.youtube.com/watch?v=invalid',
        'javascript:alert(1)',
        'https://www.youtube.com.evil.example/watch?v=F7a0lp0cEyY'
    ].forEach(value => assert.equal(security.parseYouTubeUrl(value, base), null, value));
});

test('restricts image URLs to local assets, configured Storage and Google profile images', () => {
    const base = 'https://ardaltunel.github.io/blog/post.html?id=122';
    const storage = 'https://project-ref.supabase.co/storage/v1/object/public/blog-images/uploads/user/avatar.png';
    const googleAvatar = 'https://lh3.googleusercontent.com/a/example-profile=s96-c';
    assert.equal(security.safeImageUrl(storage, '', base), storage);
    assert.equal(security.safeImageUrl(googleAvatar, '', base), googleAvatar);
    assert.equal(
        security.safeImageUrl('./assets/images/photo.jpg', '', base),
        'https://ardaltunel.github.io/blog/assets/images/photo.jpg'
    );
    ['https://evil.example/tracker.png', 'https://lh3.googleusercontent.com/not-a-profile/image.png', 'https://lh3.googleusercontent.com.evil.example/a/image', 'data:image/svg+xml,test', 'blob:https://evil.example/id', '../photo.jpg', '..%2Fphoto.jpg']
        .forEach(value => assert.equal(security.safeImageUrl(value, '', base), null, value));
});

test('reads a trusted Google avatar only from a linked Google identity', () => {
    const googleAvatar = 'https://lh3.googleusercontent.com/a/example-profile=s96-c';
    assert.equal(security.getGoogleAvatar({
        identities: [{ provider: 'google', identity_data: { picture: googleAvatar } }]
    }), googleAvatar);
    assert.equal(security.getGoogleAvatar({
        identities: [{ provider: 'email', identity_data: {} }],
        user_metadata: { avatar_url: googleAvatar }
    }), null);
    assert.equal(security.getGoogleAvatar({
        identities: [{ provider: 'google', identity_data: { avatar_url: 'https://evil.example/avatar.png' } }]
    }), null);
});

test('validates text, credentials and upload metadata without trusting file names', () => {
    assert.equal(security.validateText('  title  ', { min: 1, max: 20 }), 'title');
    assert.equal(security.validateText('bad\u0000value', { max: 20 }), null);
    assert.equal(security.validateEmail('user@example.com'), 'user@example.com');
    assert.equal(security.validateEmail('not-an-email'), null);
    assert.equal(security.validatePassword('12345678'), '12345678');
    assert.equal(security.validatePassword('short'), null);
    assert.deepEqual(
        security.validateImageFile({ name: '../../x.php', size: 100, type: 'image/png' }, 1000).extension,
        'png'
    );
    assert.equal(security.validateImageFile({ name: 'x.svg', size: 100, type: 'image/svg+xml' }, 1000), null);
});

test('checks image magic bytes instead of trusting the MIME type alone', async () => {
    const validPng = new Blob([
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ], { type: 'image/png' });
    const fakePng = new Blob(['not an image'], { type: 'image/png' });
    assert.equal(await security.hasValidImageSignature(validPng, 'png'), true);
    assert.equal(await security.hasValidImageSignature(fakePng, 'png'), false);
});

test('normalizes literal legacy line break escape sequences', () => {
    assert.equal(
        security.normalizeLegacyLineBreaks('<p>First</p>\\r\\n\\r\\n<p>Second</p>'),
        '<p>First</p>\n\n<p>Second</p>'
    );
    assert.equal(security.normalizeLegacyLineBreaks('First\\nSecond'), 'First\nSecond');
});
