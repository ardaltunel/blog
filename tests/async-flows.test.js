const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const security = require('../assets/js/security.js');

const source = readFileSync('assets/js/auth-pages.js', 'utf8');
function setup(insert = async () => ({ error: null })) {
    const listeners = new Map();
    const attributes = new Map();
    let resets = 0;
    const form = {
        addEventListener: (name, callback) => listeners.set(name, callback),
        querySelector: () => button,
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: name => attributes.get(name),
        reset: () => { resets += 1; }
    };
    const button = { form, disabled: false };
    const message = {};
    const document = {
        querySelector: selector => selector === '#auth-message' ? message : null,
        addEventListener: (name, callback) => listeners.set(`document:${name}`, callback)
    };
    const window = {
        SecurityUtils: { ...security, renderUi: () => {} },
        authConfig: { storageBucket: 'blog-images' },
        authClient: {
            from: () => ({ insert }),
            storage: { from: () => ({ remove: async () => { throw new Error('offline'); } }) }
        },
        setTimeout: () => 1,
        clearTimeout: () => {}
    };
    const context = vm.createContext({
        document, window,
        FormData: class { get(name) { return name === 'category_title' ? 'Tasarım' : 'Açıklama'; } }
    });
    vm.runInContext(source.replace('    setupSignin();',
        '    globalThis.api = { renderAddCategory, cleanupUpload };\n    setupSignin();'), context);
    let refreshes = 0;
    context.api.renderAddCategory({ querySelector: () => form }, async () => { refreshes += 1; });
    return { form, button, listeners, message, api: context.api,
        resets: () => resets, refreshes: () => refreshes };
}

test('category save survives currentTarget becoming null after the async boundary', async () => {
    const fixture = setup();
    const event = { currentTarget: fixture.form, preventDefault() {} };
    const pending = fixture.listeners.get('submit')(event);
    event.currentTarget = null;
    assert.equal(fixture.button.disabled, true);
    await pending;
    assert.equal(fixture.resets(), 1);
    assert.equal(fixture.refreshes(), 1);
    assert.equal(fixture.button.disabled, false);
    assert.equal(fixture.message.textContent, 'Kategori eklendi.');
});

test('pending forms block repeated submit events and unlock after a rejected request', async () => {
    let reject;
    const fixture = setup(() => new Promise((_, fail) => { reject = fail; }));
    const pending = fixture.listeners.get('submit')({ currentTarget: fixture.form, preventDefault() {} });
    let prevented = false;
    let stopped = false;
    fixture.listeners.get('document:submit')({
        target: fixture.form,
        preventDefault: () => { prevented = true; },
        stopImmediatePropagation: () => { stopped = true; }
    });
    assert.ok(prevented && stopped);
    reject(new Error('offline'));
    await pending;
    assert.equal(fixture.resets(), 0);
    assert.equal(fixture.button.disabled, false);
    assert.equal(fixture.form.getAttribute('aria-busy'), 'false');
    assert.match(fixture.message.textContent, /tekrar deneyin/);
});

test('best-effort upload cleanup never masks a completed save', async () => {
    const fixture = setup();
    await assert.doesNotReject(fixture.api.cleanupUpload('uploads/test.png'));
});

test('theme helpers survive browsers that throw when accessing localStorage', () => {
    const window = {};
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    vm.runInNewContext(readFileSync('assets/js/security.js', 'utf8'), { window, URL, URLSearchParams });
    assert.equal(window.SecurityUtils.getStoredTheme(), 'dark');
    assert.equal(window.SecurityUtils.setStoredTheme('light'), false);
});

test('prerendered articles enhance their HTML without downloading the archive', () => {
    let enhanced = false;
    const content = {};
    const document = {
        body: { dataset: { page: 'post', prerendered: 'true' } },
        documentElement: { dataset: {} },
        querySelector: selector => selector === '#post-content' ? content : {}
    };
    const window = {
        location: { pathname: '/blog/example/', hash: '' },
        SecurityUtils: { getSafeSupabaseConfig: () => ({}) },
        authClient: { from() { throw new Error('Unexpected remote request'); } },
        ContentEnhancements: { enhance(node) { assert.equal(node, content); enhanced = true; } }
    };
    vm.runInNewContext(readFileSync('assets/js/app.js', 'utf8'), { window, document });
    assert.equal(enhanced, true);
});
