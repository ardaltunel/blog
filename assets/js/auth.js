(function initializeAuth() {
    'use strict';

    const security = window.SecurityUtils;
    const authConfig = security?.getSafeSupabaseConfig();
    const memoryStorage = (() => {
        const values = new Map();
        return {
            getItem: key => values.get(key) || null,
            removeItem: key => values.delete(key),
            setItem: (key, value) => values.set(key, value)
        };
    })();
    const getAuthStorage = () => {
        try {
            const key = '__storage_test__';
            window.sessionStorage.setItem(key, '1');
            window.sessionStorage.removeItem(key);
            return window.sessionStorage;
        } catch {
            return memoryStorage;
        }
    };
    const authClient = authConfig && window.supabase?.createClient
        ? window.supabase.createClient(authConfig.url, authConfig.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: getAuthStorage()
            }
        })
        : null;

    const getProfile = async () => {
        if (!authClient) {
            return { user: null, profile: null };
        }

        const { data: userData, error: userError } = await authClient.auth.getUser();
        const user = userError ? null : userData.user;
        if (!user) {
            return { user: null, profile: null };
        }

        const { data, error } = await authClient
            .from('authors')
            .select('id,firstname,lastname,avatar,is_admin,user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error || !data || security.toSafeId(data.id) === null || !security.validateUuid(data.user_id)) {
            return { user, profile: null };
        }

        const firstname = security.validateText(data.firstname, { min: 1, max: 80 });
        const lastname = security.validateText(data.lastname || '', { max: 80 });
        if (firstname === null || lastname === null) {
            return { user, profile: null };
        }

        return {
            user,
            profile: {
                id: security.toSafeId(data.id),
                user_id: data.user_id,
                firstname,
                lastname,
                avatar: security.safeImageUrl(data.avatar),
                is_admin: data.is_admin === true
            }
        };
    };

    const createNavItem = (label, href, className = '', itemClassName = '') => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (itemClassName) {
            item.className = itemClassName;
        }
        if (className) {
            link.className = className;
        }
        item.append(link);
        return item;
    };

    const setNavAuth = async () => {
        const navItems = document.querySelector('.nav__items');
        if (!navItems) {
            return;
        }

        let profileResult = { user: null, profile: null };
        if (authClient) {
            try {
                profileResult = await getProfile();
            } catch {
                profileResult = { user: null, profile: null };
            }
        }

        navItems.replaceChildren();
        if (!profileResult.user) {
            navItems.append(createNavItem('Signin', security.buildRoute('signin')));
            return;
        }

        const isDashboardPage = Boolean(document.querySelector('.dashboard'));
        if (isDashboardPage) {
            const activeView = security.getQueryParam('view') || 'my-posts';
            const createAdminNavItem = (label, view) => createNavItem(
                label,
                security.buildRoute('admin', { view }),
                `nav__admin-item${activeView === view ? ' active' : ''}`,
                'nav__admin-entry'
            );
            navItems.append(
                createNavItem('Dashboard', security.buildRoute('admin'), 'nav__desktop-item', 'nav__desktop-entry'),
                createNavItem('Write', security.buildRoute('addPost'), 'nav__desktop-item', 'nav__desktop-entry'),
                createNavItem('Add Post', security.buildRoute('addPost'), 'nav__admin-item', 'nav__admin-entry'),
                createAdminNavItem('Profile', 'profile'),
                createAdminNavItem('My Posts', 'my-posts')
            );
            if (profileResult.profile?.is_admin) {
                navItems.append(
                    createAdminNavItem('All Posts', 'all-posts'),
                    createAdminNavItem('Add User', 'add-user'),
                    createAdminNavItem('Manage Users', 'manage-users'),
                    createAdminNavItem('Add Category', 'add-category'),
                    createAdminNavItem('Manage Categories', 'manage-categories')
                );
            }
        } else {
            navItems.append(
                createNavItem('Dashboard', security.buildRoute('admin')),
                createNavItem('Write', security.buildRoute('addPost'))
            );
        }
        navItems.append(createNavItem('Logout', '#', 'nav__logout'));
        navItems.querySelector('.nav__logout')?.addEventListener('click', async event => {
            event.preventDefault();
            await authClient.auth.signOut({ scope: 'local' });
            security.navigate('home');
        });
    };

    window.authConfig = authConfig;
    window.authClient = authClient;
    window.getProfile = getProfile;
    setNavAuth();
}());
