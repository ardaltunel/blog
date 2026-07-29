(function initializeAuth() {
    'use strict';

    const security = window.SecurityUtils;
    const authConfig = security?.getSafeSupabaseConfig();
    const authSessionManager = window.AuthStorage?.create();
    const fallbackStorage = (() => {
        const values = new Map();
        return Object.freeze({
            getItem: key => values.get(String(key)) ?? null,
            removeItem: key => values.delete(String(key)),
            setItem: (key, value) => values.set(String(key), String(value))
        });
    })();
    const authClient = authConfig && window.supabase?.createClient
        ? window.supabase.createClient(authConfig.url, authConfig.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: authSessionManager?.storage || fallbackStorage
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
            navItems.append(createNavItem('Giriş yap', security.buildRoute('signin')));
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
                createNavItem('Yönetim', security.buildRoute('admin'), 'nav__desktop-item', 'nav__desktop-entry'),
                createNavItem('Yazı yaz', security.buildRoute('addPost'), 'nav__desktop-item', 'nav__desktop-entry'),
                createNavItem('Yazı ekle', security.buildRoute('addPost'), 'nav__admin-item', 'nav__admin-entry'),
                createAdminNavItem('Profil', 'profile'),
                createAdminNavItem('Yazılarım', 'my-posts')
            );
            if (profileResult.profile?.is_admin) {
                navItems.append(
                    createAdminNavItem('Tüm yazılar', 'all-posts'),
                    createAdminNavItem('Kullanıcı ekle', 'add-user'),
                    createAdminNavItem('Kullanıcıları yönet', 'manage-users'),
                    createAdminNavItem('Kategori ekle', 'add-category'),
                    createAdminNavItem('Kategorileri yönet', 'manage-categories')
                );
            }
        } else {
            navItems.append(
                createNavItem('Yönetim', security.buildRoute('admin')),
                createNavItem('Yazı yaz', security.buildRoute('addPost'))
            );
        }
        navItems.append(createNavItem('Çıkış yap', '#', 'nav__logout'));
        navItems.querySelector('.nav__logout')?.addEventListener('click', async event => {
            event.preventDefault();
            await authClient.auth.signOut({ scope: 'local' });
            security.navigate('home');
        });
    };

    window.authConfig = authConfig;
    window.authClient = authClient;
    window.authSessionManager = authSessionManager;
    window.getProfile = getProfile;
    setNavAuth();
}());
