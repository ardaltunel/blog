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

    try {
        const requestedPage = window.location.search.match(/(?:^\?|&)page=([1-9]\d{0,5})(?:&|$)/)?.[1];
        const pageNumber = Number(requestedPage);
        if (pageNumber > 1 && pageNumber <= 100000) {
            document.documentElement.dataset.paginationPending = 'true';
            document.documentElement.dataset.paginationStartedAt = String(Date.now());
        }
    } catch {
        delete document.documentElement.dataset.paginationPending;
        delete document.documentElement.dataset.paginationStartedAt;
    }
}());
