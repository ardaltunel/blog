(function initializeUi() {
    'use strict';

    const security = window.SecurityUtils;
    const navItems = document.querySelector('.nav__items');
    const openNavBtn = document.querySelector('#open__nav-btn');
    const closeNavBtn = document.querySelector('#close__nav-btn');
    const themeToggles = document.querySelectorAll('.theme__toggle');
    const navLogo = document.querySelector('.nav__logo');

    if (navLogo && security) {
        navLogo.href = security.buildRoute('home');
    }

    const canonicalRoute = document.body.dataset.route;
    if (canonicalRoute && security) {
        const queryPage = canonicalRoute === 'home' ? security.getQueryParam('page') : null;
        const renderedPage = canonicalRoute === 'home'
            ? security.getQueryParam('page', `?page=${encodeURIComponent(document.body.dataset.homePage || '1')}`) || 1
            : null;
        const requestedPage = queryPage || renderedPage;
        const canonicalValues = requestedPage ? { page: requestedPage } : {};
        const canonicalUrl = new URL(security.buildRoute(canonicalRoute, canonicalValues), window.location.href);
        if (queryPage && canonicalUrl.pathname !== window.location.pathname) {
            window.location.replace(`${canonicalUrl.pathname}${canonicalUrl.search}${window.location.hash}`);
            return;
        }
        if (`${window.location.pathname}${window.location.search}` !== `${canonicalUrl.pathname}${canonicalUrl.search}`) {
            window.history.replaceState(null, '', `${canonicalUrl.pathname}${canonicalUrl.search}${window.location.hash}`);
        }
        let canonicalLink = document.querySelector('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.rel = 'canonical';
            document.head.append(canonicalLink);
        }
        canonicalLink.href = canonicalUrl.href;
    }

    const setTheme = (theme) => {
        const safeTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = safeTheme;
        security?.setStoredTheme(safeTheme);
        themeToggles.forEach(button => {
            button.setAttribute('aria-label', safeTheme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
        });
    };

    setTheme(security?.getStoredTheme() || 'dark');
    themeToggles.forEach(button => {
        button.addEventListener('click', () => {
            setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        });
    });

    if (navItems && openNavBtn && closeNavBtn) {
        const nav = navItems.closest('nav');
        const desktopMedia = window.matchMedia('(min-width: 1025px)');

        if (!navItems.id) {
            navItems.id = 'site-navigation';
        }
        [openNavBtn, closeNavBtn].forEach(button => {
            button.setAttribute('aria-controls', navItems.id);
        });

        const background = Array.from(document.body.children).filter(element =>
            element !== nav && !['SCRIPT', 'LINK'].includes(element.tagName)
        );
        const initialInert = new Map(background.map(element => [element, element.inert]));
        const setNavOpen = (isOpen, restoreFocus = false) => {
            background.forEach(element => { element.inert = isOpen || initialInert.get(element); });
            navItems.classList.toggle('is-open', isOpen);
            openNavBtn.hidden = isOpen;
            closeNavBtn.hidden = !isOpen;
            openNavBtn.setAttribute('aria-expanded', String(isOpen));
            closeNavBtn.setAttribute('aria-expanded', String(isOpen));
            document.body.classList.toggle('nav-open', isOpen);

            if (restoreFocus) {
                openNavBtn.focus();
            }
        };

        setNavOpen(false);

        openNavBtn.addEventListener('click', () => {
            setNavOpen(true);
            closeNavBtn.focus();
        });

        closeNavBtn.addEventListener('click', () => {
            setNavOpen(false, true);
        });

        navItems.addEventListener('click', event => {
            if (event.target.closest('a')) {
                setNavOpen(false);
            }
        });

        document.addEventListener('click', event => {
            if (navItems.classList.contains('is-open') && nav && !nav.contains(event.target)) {
                setNavOpen(false);
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Tab' && navItems.classList.contains('is-open')) {
                const controls = Array.from(nav.querySelectorAll('a, button:not([disabled])'))
                    .filter(element => element.getClientRects().length && !element.hidden);
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
            if (event.key === 'Escape' && navItems.classList.contains('is-open')) {
                setNavOpen(false, true);
            }
        });

        desktopMedia.addEventListener('change', event => {
            if (event.matches) {
                setNavOpen(false);
            }
        });
    }

    const privacyLink = document.querySelector('.site-footer__privacy');
    if (privacyLink) {
        const dialog = document.createElement('dialog');
        dialog.className = 'privacy-dialog';
        dialog.setAttribute('aria-labelledby', 'privacy-dialog-title');
        const heading = document.createElement('h2');
        heading.id = 'privacy-dialog-title';
        heading.textContent = 'Gizlilik politikası';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'privacy-dialog__close';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Gizlilik politikasını kapat');
        const body = document.createElement('div');
        body.className = 'privacy-dialog__body';
        body.setAttribute('aria-live', 'polite');
        const header = document.createElement('header');
        header.className = 'privacy-dialog__header';
        const label = document.createElement('p');
        label.className = 'privacy-dialog__label';
        label.textContent = 'ARDALTUNEL · BİLGİLENDİRME';
        const titleGroup = document.createElement('div');
        titleGroup.append(label, heading);
        header.append(titleGroup, close);
        dialog.append(header, body);
        document.body.append(dialog);
        close.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
        dialog.addEventListener('close', () => privacyLink.focus());
        let loaded = false;
        let loading = false;
        privacyLink.setAttribute('aria-haspopup', 'dialog');
        privacyLink.addEventListener('click', async event => {
            event.preventDefault();
            if (!dialog.open) dialog.showModal();
            if (loaded || loading) return;
            loading = true;
            body.textContent = 'Yükleniyor…';
            try {
                const response = await fetch(privacyLink.href, { signal: AbortSignal.timeout(10000) });
                if (!response.ok) throw new Error('Privacy unavailable');
                const documentCopy = new DOMParser().parseFromString(await response.text(), 'text/html');
                const sections = documentCopy.querySelectorAll('.legal__container section');
                if (!sections.length) throw new Error('Privacy content missing');
                const content = document.createDocumentFragment();
                sections.forEach(section => {
                    const group = document.createElement('section');
                    section.querySelectorAll('h2, p').forEach(source => {
                        const node = document.createElement(source.tagName === 'H2' ? 'h3' : 'p');
                        source.childNodes.forEach(child => {
                            if (child.nodeName === 'A') {
                                const url = new URL(child.getAttribute('href'), privacyLink.href);
                                if (url.protocol === 'https:') {
                                    const anchor = document.createElement('a');
                                    anchor.href = url.href;
                                    anchor.textContent = child.textContent;
                                    node.append(anchor);
                                    return;
                                }
                            }
                            node.append(document.createTextNode(child.textContent));
                        });
                        group.append(node);
                    });
                    content.append(group);
                });
                body.replaceChildren(content);
                loaded = true;
            } catch {
                body.textContent = 'Gizlilik politikası yüklenemedi. Lütfen pencereyi kapatıp tekrar deneyin.';
            } finally {
                loading = false;
            }
        });
    }
}());
