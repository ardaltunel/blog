const test = require('node:test');
const assert = require('node:assert/strict');

const AuthStorage = require('../assets/js/auth-storage.js');

const createStorage = () => {
    const values = new Map();
    return {
        getItem: key => values.get(String(key)) ?? null,
        removeItem: key => values.delete(String(key)),
        setItem: (key, value) => values.set(String(key), String(value))
    };
};

test('keeps the default auth session limited to the current tab', () => {
    const local = createStorage();
    const session = createStorage();
    const manager = AuthStorage.create({ persistentStorage: local, temporaryStorage: session });
    manager.storage.setItem('sb-auth-token', 'temporary-token');

    assert.equal(manager.isRemembered(), false);
    assert.equal(session.getItem('sb-auth-token'), 'temporary-token');
    assert.equal(local.getItem('sb-auth-token'), null);
});

test('moves the session to persistent storage when remember me is enabled', () => {
    const local = createStorage();
    const session = createStorage();
    const manager = AuthStorage.create({ persistentStorage: local, temporaryStorage: session });
    manager.storage.setItem('sb-auth-token', 'remembered-token');

    assert.equal(manager.setRememberMe(true), true);
    assert.equal(local.getItem('sb-auth-token'), 'remembered-token');
    assert.equal(session.getItem('sb-auth-token'), null);

    const nextBrowserSession = AuthStorage.create({
        persistentStorage: local,
        temporaryStorage: createStorage()
    });
    assert.equal(nextBrowserSession.isRemembered(), true);
    assert.equal(nextBrowserSession.storage.getItem('sb-auth-token'), 'remembered-token');
});

test('moves a remembered session back to tab storage when disabled', () => {
    const local = createStorage();
    const firstSession = createStorage();
    const remembered = AuthStorage.create({ persistentStorage: local, temporaryStorage: firstSession });
    remembered.storage.setItem('sb-auth-token', 'token');
    remembered.setRememberMe(true);

    const currentSession = createStorage();
    const manager = AuthStorage.create({ persistentStorage: local, temporaryStorage: currentSession });
    assert.equal(manager.storage.getItem('sb-auth-token'), 'token');
    assert.equal(manager.setRememberMe(false), true);
    assert.equal(local.getItem('sb-auth-token'), null);
    assert.equal(currentSession.getItem('sb-auth-token'), 'token');
});

test('falls back safely when persistent storage is unavailable', () => {
    const unavailable = {
        getItem: () => {
            throw new Error('blocked');
        },
        removeItem: () => {
            throw new Error('blocked');
        },
        setItem: () => {
            throw new Error('blocked');
        }
    };
    const session = createStorage();
    const manager = AuthStorage.create({ persistentStorage: unavailable, temporaryStorage: session });

    assert.equal(manager.canRemember(), false);
    assert.equal(manager.setRememberMe(true), false);
    manager.storage.setItem('sb-auth-token', 'temporary-token');
    assert.equal(session.getItem('sb-auth-token'), 'temporary-token');
});
