(function initializeUi() {
    'use strict';

    const security = window.SecurityUtils;
    const navItems = document.querySelector('.nav__items');
    const openNavBtn = document.querySelector('#open__nav-btn');
    const closeNavBtn = document.querySelector('#close__nav-btn');
    const themeToggles = document.querySelectorAll('.theme__toggle');

    const setTheme = (theme) => {
        const safeTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = safeTheme;
        security?.setStoredTheme(safeTheme);
        themeToggles.forEach(button => {
            const icon = button.querySelector('img');
            if (icon) {
                const iconName = safeTheme === 'dark' ? 'sun' : 'moon';
                icon.src = `./assets/vendor/lucide/icons/${iconName}.svg`;
            }
        });
    };

    setTheme(security?.getStoredTheme() || 'dark');
    themeToggles.forEach(button => {
        button.addEventListener('click', () => {
            setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        });
    });

    if (navItems && openNavBtn && closeNavBtn) {
        openNavBtn.addEventListener('click', () => {
            navItems.classList.add('is-open');
            openNavBtn.hidden = true;
            closeNavBtn.hidden = false;
        });
        closeNavBtn.addEventListener('click', () => {
            navItems.classList.remove('is-open');
            openNavBtn.hidden = false;
            closeNavBtn.hidden = true;
        });
    }
}());
