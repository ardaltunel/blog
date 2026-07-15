const navItems = document.querySelector('.nav__items');
const openNavBtn = document.querySelector('#open__nav-btn');
const closeNavBtn = document.querySelector('#close__nav-btn');
const sidebar = document.querySelector('aside');
const showSidebarBtn = document.querySelector('#show__sidebar-btn');
const hideSidebarBtn = document.querySelector('#hide__sidebar-btn');
const themeToggles = document.querySelectorAll('.theme__toggle');

const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);

    themeToggles.forEach((button) => {
        const icon = button.querySelector('i');
        if (!icon) {
            return;
        }

        icon.className = theme === 'dark' ? 'uil uil-sun' : 'uil uil-moon';
    });
};

setTheme(localStorage.getItem('theme') || 'dark');

themeToggles.forEach((button) => {
    button.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    });
});

if (navItems && openNavBtn && closeNavBtn) {
    openNavBtn.addEventListener('click', () => {
        navItems.style.display = 'flex';
        openNavBtn.style.display = 'none';
        closeNavBtn.style.display = 'inline-flex';
    });

    closeNavBtn.addEventListener('click', () => {
        navItems.style.display = 'none';
        openNavBtn.style.display = 'inline-flex';
        closeNavBtn.style.display = 'none';
    });
}

if (sidebar && showSidebarBtn && hideSidebarBtn) {
    showSidebarBtn.addEventListener('click', () => {
        sidebar.style.left = '0';
        showSidebarBtn.style.display = 'none';
        hideSidebarBtn.style.display = 'inline-flex';
    });

    hideSidebarBtn.addEventListener('click', () => {
        sidebar.style.left = '-100%';
        showSidebarBtn.style.display = 'inline-flex';
        hideSidebarBtn.style.display = 'none';
    });
}
