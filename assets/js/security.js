(function initializeSecurity(global) {
    'use strict';

    const MAX_ID = 999999999;
    const MAX_PAGE = 100000;
    const MAX_URL_LENGTH = 2048;
    const DEFAULT_AVATAR = './assets/images/1663704007ardaltunel-pp.png';
    const ADMIN_VIEWS = Object.freeze([
        'profile',
        'my-posts',
        'all-posts',
        'add-user',
        'manage-users',
        'add-category',
        'manage-categories'
    ]);
    const ROUTES = Object.freeze({
        home: './index.html',
        post: './post.html',
        category: './category.html',
        signin: './signin.html',
        signup: './signup.html',
        admin: './admin.html',
        addPost: './add-post.html'
    });
    const QUERY_RULES = Object.freeze({
        id: Object.freeze({ type: 'integer', min: 1, max: MAX_ID, maxDigits: 9 }),
        page: Object.freeze({ type: 'integer', min: 1, max: MAX_PAGE, maxDigits: 6 }),
        view: Object.freeze({ type: 'enum', values: ADMIN_VIEWS })
    });
    const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
    const IMAGE_MIME_TYPES = Object.freeze({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    });

    const currentBaseUrl = () => global.location?.href || 'https://example.invalid/';
    const currentOrigin = () => new URL(currentBaseUrl()).origin;
    const normalizeString = value => typeof value === 'string' ? value : '';
    const containsControlCharacters = value => /[\u0000-\u001F\u007F]/.test(value);
    const containsTraversalEncoding = value => /(?:^|[\\/])\.\.(?:[\\/]|$)|%00|%2e|%2f|%5c|%25|\\/i.test(value);

    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const parsePositiveInteger = (value, rule = QUERY_RULES.id) => {
        if (typeof value !== 'string' || value.length > rule.maxDigits || !/^[1-9]\d*$/.test(value)) {
            return null;
        }

        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed >= rule.min && parsed <= rule.max ? parsed : null;
    };

    const toSafeId = (value) => {
        if (typeof value === 'number') {
            return Number.isSafeInteger(value) && value > 0 && value <= MAX_ID ? value : null;
        }

        return parsePositiveInteger(String(value), QUERY_RULES.id);
    };

    const getQueryParam = (name, search = global.location?.search || '') => {
        const rule = QUERY_RULES[name];
        if (!rule || FORBIDDEN_KEYS.has(name)) {
            return null;
        }

        const params = new URLSearchParams(search);
        const values = params.getAll(name);
        if (values.length !== 1) {
            return null;
        }

        const value = values[0];
        if (rule.type === 'integer') {
            return parsePositiveInteger(value, rule);
        }

        if (rule.type === 'enum') {
            return rule.values.includes(value) ? value : null;
        }

        return null;
    };

    const safeContentUrl = (value, baseUrl = currentBaseUrl()) => {
        const raw = normalizeString(value).trim();
        if (!raw || raw.length > MAX_URL_LENGTH || containsControlCharacters(raw) || raw.startsWith('//') || containsTraversalEncoding(raw)) {
            return null;
        }

        if (/^(mailto:|tel:)/i.test(raw)) {
            return /^(mailto:[^\s@]+@[^\s@]+|tel:\+?[0-9 ()-]{5,30})$/i.test(raw) ? raw : null;
        }

        let parsed;
        try {
            parsed = new URL(raw, baseUrl);
        } catch {
            return null;
        }

        if (parsed.username || parsed.password) {
            return null;
        }

        if (parsed.origin === new URL(baseUrl).origin && ['http:', 'https:'].includes(parsed.protocol)) {
            return parsed.href;
        }

        return parsed.protocol === 'https:' ? parsed.href : null;
    };

    const parseYouTubeTime = value => {
        const raw = normalizeString(value).trim().toLowerCase();
        if (!raw) {
            return 0;
        }
        if (/^\d{1,6}s?$/.test(raw)) {
            return Math.min(Number.parseInt(raw, 10), 86400);
        }
        if (raw.length > 9 || !/^[0-9hms]+$/.test(raw)) {
            return 0;
        }
        const matches = Array.from(raw.matchAll(/(\d{1,2})([hms])/g));
        if (!matches.length || matches.map(match => match[0]).join('') !== raw) {
            return 0;
        }
        const multipliers = Object.freeze({ h: 3600, m: 60, s: 1 });
        const order = Object.freeze({ h: 3, m: 2, s: 1 });
        let previousOrder = 4;
        let seconds = 0;
        for (const match of matches) {
            if (order[match[2]] >= previousOrder) {
                return 0;
            }
            previousOrder = order[match[2]];
            seconds += Number(match[1]) * multipliers[match[2]];
        }
        return Math.min(seconds, 86400);
    };

    const parseYouTubeUrl = (value, baseUrl = currentBaseUrl()) => {
        const raw = normalizeString(value).trim();
        const candidate = /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(raw)
            ? `https://${raw}`
            : raw;
        const safeUrl = safeContentUrl(candidate, baseUrl);
        if (!safeUrl) {
            return null;
        }

        const parsed = new URL(safeUrl);
        const host = parsed.hostname.toLowerCase();
        let videoId = '';
        if (host === 'youtu.be' || host === 'www.youtu.be') {
            videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
        } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
            const segments = parsed.pathname.split('/').filter(Boolean);
            if (parsed.pathname === '/watch') {
                videoId = parsed.searchParams.get('v') || '';
            } else if (['embed', 'live', 'shorts'].includes(segments[0])) {
                videoId = segments[1] || '';
            }
        }

        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
            return null;
        }

        const start = parseYouTubeTime(parsed.searchParams.get('start') || parsed.searchParams.get('t') || '');
        const startQuery = start ? `&start=${start}` : '';
        const watchTime = start ? `&t=${start}s` : '';
        return Object.freeze({
            id: videoId,
            start,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}${watchTime}`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${startQuery}`
        });
    };

    const trustedSupabaseOrigin = () => {
        const rawUrl = normalizeString(global.SUPABASE_CONFIG?.url).trim();
        try {
            const parsed = new URL(rawUrl);
            return parsed.protocol === 'https:' && parsed.pathname === '/' ? parsed.origin : null;
        } catch {
            return null;
        }
    };

    const safeImageUrl = (value, fallback = DEFAULT_AVATAR, baseUrl = currentBaseUrl()) => {
        let raw = normalizeString(value).trim();
        if (!raw) {
            raw = fallback;
        } else if (/^[^\\/]+\.(?:png|jpe?g|webp|gif)$/i.test(raw)) {
            raw = `./assets/images/${raw}`;
        } else if (raw.startsWith('images/')) {
            raw = `./assets/${raw}`;
        }

        if (raw.length > MAX_URL_LENGTH || containsControlCharacters(raw) || raw.startsWith('//') || containsTraversalEncoding(raw)) {
            return fallback === raw ? null : safeImageUrl(fallback, fallback, baseUrl);
        }

        let parsed;
        try {
            parsed = new URL(raw, baseUrl);
        } catch {
            return fallback === raw ? null : safeImageUrl(fallback, fallback, baseUrl);
        }

        if (parsed.username || parsed.password || parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return fallback === raw ? null : safeImageUrl(fallback, fallback, baseUrl);
        }

        const localAsset = parsed.origin === new URL(baseUrl).origin && /\/assets\/(?:images|favicon|logo|vendor)\//.test(parsed.pathname);
        const supabaseOrigin = trustedSupabaseOrigin();
        const bucket = encodeURIComponent(normalizeString(global.SUPABASE_CONFIG?.storageBucket) || 'blog-images');
        const trustedStorage = parsed.origin === supabaseOrigin
            && parsed.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);

        if (!localAsset && !trustedStorage) {
            return fallback === raw ? null : safeImageUrl(fallback, fallback, baseUrl);
        }

        return parsed.href;
    };

    const buildRoute = (routeName, values = {}) => {
        const route = ROUTES[routeName];
        if (!route || !values || typeof values !== 'object' || Array.isArray(values)) {
            return ROUTES.home;
        }

        const params = new URLSearchParams();
        if (routeName === 'post' || routeName === 'category') {
            const id = toSafeId(values.id);
            if (id === null) {
                return ROUTES.home;
            }
            params.set('id', String(id));
        } else if (routeName === 'home' && values.page !== undefined) {
            const page = parsePositiveInteger(String(values.page), QUERY_RULES.page);
            if (page !== null && page > 1) {
                params.set('page', String(page));
            }
        } else if (routeName === 'admin' && values.view !== undefined) {
            const view = normalizeString(values.view);
            if (ADMIN_VIEWS.includes(view)) {
                params.set('view', view);
            }
        }

        const query = params.toString();
        return query ? `${route}?${query}` : route;
    };

    const safeInternalPath = (value, baseUrl = currentBaseUrl()) => {
        const raw = normalizeString(value).trim();
        if (!raw || raw.length > MAX_URL_LENGTH || raw.startsWith('//') || containsControlCharacters(raw) || containsTraversalEncoding(raw)) {
            return null;
        }

        let parsed;
        try {
            parsed = new URL(raw, baseUrl);
        } catch {
            return null;
        }
        if (parsed.origin !== new URL(baseUrl).origin || parsed.username || parsed.password) {
            return null;
        }

        const routeEntry = Object.entries(ROUTES).find(([, path]) => parsed.pathname.endsWith(path.slice(1)));
        if (!routeEntry) {
            return null;
        }
        const [routeName] = routeEntry;
        const keys = [...parsed.searchParams.keys()];
        if (new Set(keys).size !== keys.length) {
            return null;
        }

        let safeRoute;
        if (routeName === 'post' || routeName === 'category') {
            if (keys.length !== 1 || keys[0] !== 'id') {
                return null;
            }
            const id = getQueryParam('id', parsed.search);
            safeRoute = id ? buildRoute(routeName, { id }) : null;
        } else if (routeName === 'home') {
            if (keys.some(key => key !== 'page')) {
                return null;
            }
            const page = keys.length ? getQueryParam('page', parsed.search) : 1;
            safeRoute = page ? buildRoute('home', { page }) : null;
        } else if (routeName === 'admin') {
            if (keys.some(key => key !== 'view')) {
                return null;
            }
            const view = keys.length ? getQueryParam('view', parsed.search) : null;
            safeRoute = keys.length && !view ? null : buildRoute('admin', view ? { view } : {});
        } else {
            safeRoute = keys.length ? null : buildRoute(routeName);
        }

        return safeRoute ? `${safeRoute}${parsed.hash}` : null;
    };

    const navigate = (routeName, values) => {
        if (!global.location?.assign) {
            return false;
        }

        global.location.assign(buildRoute(routeName, values));
        return true;
    };

    const getStoredTheme = (storage = global.localStorage) => {
        try {
            const value = storage?.getItem('theme');
            return value === 'light' || value === 'dark' ? value : 'dark';
        } catch {
            return 'dark';
        }
    };

    const setStoredTheme = (theme, storage = global.localStorage) => {
        if (theme !== 'light' && theme !== 'dark') {
            return false;
        }

        try {
            storage?.setItem('theme', theme);
            return true;
        } catch {
            return false;
        }
    };

    const validateText = (value, { min = 0, max = 160, trim = true } = {}) => {
        if (typeof value !== 'string' || containsControlCharacters(value)) {
            return null;
        }

        const normalized = trim ? value.trim() : value;
        return normalized.length >= min && normalized.length <= max ? normalized : null;
    };

    const validateEmail = (value) => {
        const email = validateText(value, { min: 3, max: 254 });
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    };

    const validatePassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128
        && !containsControlCharacters(value) ? value : null;

    const validateUuid = value => typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const validateImageFile = (file, maxBytes = 5 * 1024 * 1024) => {
        if (!file || typeof file !== 'object' || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxBytes) {
            return null;
        }

        const extension = IMAGE_MIME_TYPES[file.type];
        return extension ? Object.freeze({ file, extension }) : null;
    };

    const normalizeLegacyLineBreaks = (value = '') => String(value)
        .replace(/\\r\\n|\\n|\\r/g, '\n');

    const hasValidImageSignature = async (file, extension) => {
        if (!file?.slice || !['jpg', 'png', 'webp'].includes(extension)) {
            return false;
        }

        try {
            const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
            if (extension === 'jpg') {
                return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
            }
            if (extension === 'png') {
                const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
                return signature.every((byte, index) => bytes[index] === byte);
            }
            return bytes.length >= 12
                && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
                && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
        } catch {
            return false;
        }
    };

    const createUploadPath = (userId, kind, extension) => {
        if (!validateUuid(userId) || !['posts', 'avatars'].includes(kind) || !['jpg', 'png', 'webp'].includes(extension)) {
            return null;
        }

        return `uploads/${userId}/${kind}/${crypto.randomUUID()}.${extension}`;
    };

    const requirePurifier = () => {
        if (!global.DOMPurify) {
            throw new Error('HTML sanitizer is unavailable.');
        }
        return global.DOMPurify;
    };

    let hooksInstalled = false;
    const safeHrefByNode = new WeakMap();
    const installPurifierHooks = () => {
        const purifier = requirePurifier();
        if (hooksInstalled) {
            return purifier;
        }

        purifier.addHook('uponSanitizeAttribute', (node, data) => {
            if (data.attrName === 'href') {
                const href = safeContentUrl(data.attrValue);
                if (!href) {
                    data.keepAttr = false;
                    safeHrefByNode.delete(node);
                } else {
                    data.attrValue = href;
                    safeHrefByNode.set(node, href);
                }
            }

            if (data.attrName === 'src') {
                const src = safeImageUrl(data.attrValue, '');
                if (!src) {
                    data.keepAttr = false;
                } else {
                    data.attrValue = src;
                }
            }
        });

        purifier.addHook('afterSanitizeAttributes', node => {
            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || safeHrefByNode.get(node);
                if (!href) {
                    node.removeAttribute('target');
                    node.removeAttribute('rel');
                    return;
                }

                node.setAttribute('href', href);
                const parsed = new URL(href, currentBaseUrl());
                if (parsed.origin !== currentOrigin()) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer nofollow');
                } else {
                    node.removeAttribute('target');
                    node.removeAttribute('rel');
                }
            }

            if (node.tagName === 'IMG' && !node.getAttribute('src')) {
                node.remove();
            }
        });

        hooksInstalled = true;
        return purifier;
    };

    const blogSanitizerOptions = Object.freeze({
        ALLOWED_TAGS: [
            'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
            'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
            's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
        ],
        ALLOWED_ATTR: ['alt', 'class', 'height', 'href', 'rel', 'src', 'target', 'title', 'width'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        FORBID_ATTR: ['style'],
        FORBID_TAGS: ['base', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'meta', 'object', 'script', 'style']
    });

    const uiSanitizerOptions = Object.freeze({
        ALLOWED_TAGS: [
            'a', 'article', 'br', 'button', 'div', 'figcaption', 'figure', 'form', 'h1',
            'h2', 'h3', 'h5', 'header', 'img', 'input', 'label', 'option', 'p', 'section', 'select', 'small', 'span',
            'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'tr'
        ],
        ALLOWED_ATTR: [
            'accept', 'alt', 'aria-label', 'checked', 'class', 'data-admin', 'data-id',
            'data-label', 'data-verified', 'disabled', 'for', 'hidden', 'id', 'maxlength', 'minlength',
            'href', 'name', 'placeholder', 'rel', 'required', 'rows', 'selected', 'src',
            'scope', 'target', 'type', 'value'
        ],
        ALLOW_DATA_ATTR: false,
        FORBID_ATTR: ['style'],
        FORBID_TAGS: ['base', 'embed', 'iframe', 'link', 'meta', 'object', 'script', 'style']
    });

    const sanitizeBlogHtml = (html = '') => installPurifierHooks().sanitize(
        normalizeLegacyLineBreaks(html),
        blogSanitizerOptions
    );
    const sanitizeBlogFragment = (html = '') => installPurifierHooks().sanitize(normalizeLegacyLineBreaks(html), {
        ...blogSanitizerOptions,
        RETURN_DOM_FRAGMENT: true
    });
    const sanitizeUiFragment = (html = '') => installPurifierHooks().sanitize(String(html), {
        ...uiSanitizerOptions,
        RETURN_DOM_FRAGMENT: true
    });
    const renderUi = (target, html) => {
        if (!target?.replaceChildren) {
            return false;
        }
        target.replaceChildren(sanitizeUiFragment(html));
        return true;
    };
    const stripHtml = (html = '') => sanitizeBlogFragment(html).textContent || '';

    const getSafeSupabaseConfig = () => {
        const source = global.SUPABASE_CONFIG;
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
            return null;
        }

        const url = normalizeString(source.url).trim();
        const anonKey = normalizeString(source.anonKey).trim();
        const storageBucket = normalizeString(source.storageBucket).trim();
        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return null;
        }

        if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/') {
            return null;
        }
        if (!/^(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+)$/.test(anonKey)) {
            return null;
        }
        if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(storageBucket)) {
            return null;
        }

        if (anonKey.startsWith('eyJ')) {
            try {
                const payload = JSON.parse(atob(anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.role !== 'anon') {
                    return null;
                }
            } catch {
                return null;
            }
        }

        return Object.freeze({ url: parsed.origin, anonKey, storageBucket });
    };

    const api = Object.freeze({
        ADMIN_VIEWS,
        DEFAULT_AVATAR,
        MAX_ID,
        MAX_PAGE,
        buildRoute,
        createUploadPath,
        escapeHtml,
        getQueryParam,
        getSafeSupabaseConfig,
        getStoredTheme,
        hasValidImageSignature,
        navigate,
        normalizeLegacyLineBreaks,
        parsePositiveInteger,
        parseYouTubeUrl,
        renderUi,
        safeContentUrl,
        safeImageUrl,
        safeInternalPath,
        sanitizeBlogFragment,
        sanitizeBlogHtml,
        sanitizeUiFragment,
        setStoredTheme,
        stripHtml,
        toSafeId,
        validateEmail,
        validateImageFile,
        validatePassword,
        validateText,
        validateUuid
    });

    global.SecurityUtils = api;
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof window === 'object' ? window : globalThis));
