(function applyInitialTheme() {
    'use strict';

    let theme = 'dark';
    try {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
            theme = storedTheme;
        }
    } catch {
        theme = 'dark';
    }
    document.documentElement.dataset.theme = theme;
}());
