(function initializeAuthStorage(global) {
    'use strict';

    const REMEMBER_KEY = 'blog-auth-remember';
    const STORAGE_TEST_KEY = '__blog_auth_storage_test__';

    const createMemoryStorage = () => {
        const values = new Map();
        return Object.freeze({
            getItem: key => values.get(String(key)) ?? null,
            removeItem: key => values.delete(String(key)),
            setItem: (key, value) => values.set(String(key), String(value))
        });
    };

    const readGlobalStorage = name => {
        try {
            return global?.[name] || null;
        } catch {
            return null;
        }
    };

    const isStorageAvailable = storage => {
        if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) {
            return false;
        }
        try {
            const previous = storage.getItem(STORAGE_TEST_KEY);
            storage.setItem(STORAGE_TEST_KEY, '1');
            if (previous === null) {
                storage.removeItem(STORAGE_TEST_KEY);
            } else {
                storage.setItem(STORAGE_TEST_KEY, previous);
            }
            return true;
        } catch {
            return false;
        }
    };

    const create = (options = {}) => {
        const persistentCandidate = options.persistentStorage ?? readGlobalStorage('localStorage');
        const temporaryCandidate = options.temporaryStorage ?? readGlobalStorage('sessionStorage');
        const persistentStorage = isStorageAvailable(persistentCandidate) ? persistentCandidate : null;
        const temporaryStorage = isStorageAvailable(temporaryCandidate)
            ? temporaryCandidate
            : createMemoryStorage();
        const observedKeys = new Set();
        let remembered = false;

        try {
            remembered = persistentStorage?.getItem(REMEMBER_KEY) === '1';
        } catch {
            remembered = false;
        }

        const safelyRead = (storage, key) => {
            try {
                return storage?.getItem(key) ?? null;
            } catch {
                return null;
            }
        };
        const safelyWrite = (storage, key, value) => {
            try {
                storage?.setItem(key, value);
                return true;
            } catch {
                return false;
            }
        };
        const safelyRemove = (storage, key) => {
            try {
                storage?.removeItem(key);
            } catch {
                return false;
            }
            return true;
        };

        const storage = Object.freeze({
            getItem: key => {
                const safeKey = String(key);
                observedKeys.add(safeKey);
                return remembered && persistentStorage
                    ? safelyRead(persistentStorage, safeKey) ?? safelyRead(temporaryStorage, safeKey)
                    : safelyRead(temporaryStorage, safeKey);
            },
            setItem: (key, value) => {
                const safeKey = String(key);
                const safeValue = String(value);
                observedKeys.add(safeKey);
                if (remembered && persistentStorage) {
                    safelyWrite(persistentStorage, safeKey, safeValue);
                    safelyRemove(temporaryStorage, safeKey);
                } else {
                    safelyWrite(temporaryStorage, safeKey, safeValue);
                    safelyRemove(persistentStorage, safeKey);
                }
            },
            removeItem: key => {
                const safeKey = String(key);
                observedKeys.add(safeKey);
                safelyRemove(temporaryStorage, safeKey);
                safelyRemove(persistentStorage, safeKey);
            }
        });

        const setRememberMe = enabled => {
            const shouldRemember = enabled === true && Boolean(persistentStorage);
            remembered = shouldRemember;
            if (persistentStorage) {
                if (remembered) {
                    safelyWrite(persistentStorage, REMEMBER_KEY, '1');
                } else {
                    safelyRemove(persistentStorage, REMEMBER_KEY);
                }
            }

            observedKeys.forEach(key => {
                if (key === REMEMBER_KEY) {
                    return;
                }
                const source = remembered ? temporaryStorage : persistentStorage;
                const destination = remembered ? persistentStorage : temporaryStorage;
                const value = safelyRead(source, key);
                if (value !== null) {
                    safelyWrite(destination, key, value);
                }
                safelyRemove(source, key);
            });
            return remembered === enabled;
        };

        return Object.freeze({
            canRemember: () => Boolean(persistentStorage),
            isRemembered: () => remembered,
            setRememberMe,
            storage
        });
    };

    const api = Object.freeze({ create });
    global.AuthStorage = api;
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof window === 'object' ? window : globalThis));
