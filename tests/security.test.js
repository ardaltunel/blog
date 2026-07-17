const test = require('node:test');
const assert = require('node:assert/strict');

global.SUPABASE_CONFIG = {
    url: 'https://project-ref.supabase.co',
    anonKey: 'sb_publishable_test_key',
    storageBucket: 'blog-images'
};

const security = require('../assets/js/security.js');

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

test('builds routes only from the fixed route and parameter allowlists', () => {
    assert.equal(security.buildRoute('post', { id: 122 }), './post.html?id=122');
    assert.equal(security.buildRoute('post', { id: '122abc' }), './index.html');
    assert.equal(security.buildRoute('admin', { view: 'manage-users' }), './admin.html?view=manage-users');
    assert.equal(security.buildRoute('admin', { view: 'https://evil.example' }), './admin.html');
    assert.equal(security.buildRoute('https://evil.example'), './index.html');
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

test('restricts image URLs to local assets and the configured Storage bucket', () => {
    const base = 'https://ardaltunel.github.io/blog/post.html?id=122';
    const storage = 'https://project-ref.supabase.co/storage/v1/object/public/blog-images/uploads/user/avatar.png';
    assert.equal(security.safeImageUrl(storage, '', base), storage);
    assert.equal(
        security.safeImageUrl('./assets/images/photo.jpg', '', base),
        'https://ardaltunel.github.io/blog/assets/images/photo.jpg'
    );
    ['https://evil.example/tracker.png', 'data:image/svg+xml,test', 'blob:https://evil.example/id', '../photo.jpg', '..%2Fphoto.jpg']
        .forEach(value => assert.equal(security.safeImageUrl(value, '', base), null, value));
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
