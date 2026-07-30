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
        const canonicalUrl = new URL(security.buildRoute(canonicalRoute), window.location.href);
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
            const icon = button.querySelector('img');
            if (icon) {
                const iconName = safeTheme === 'dark' ? 'sun' : 'moon';
                icon.src = security?.sitePath(`assets/vendor/lucide/icons/${iconName}.svg`)
                    || `./assets/vendor/lucide/icons/${iconName}.svg`;
            }
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

        const setNavOpen = (isOpen, restoreFocus = false) => {
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
}());
