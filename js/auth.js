const authConfig = window.SUPABASE_CONFIG || {};
const authClient = authConfig.url && authConfig.anonKey && window.supabase
    ? window.supabase.createClient(authConfig.url, authConfig.anonKey)
    : null;

const getProfile = async () => {
    if (!authClient) {
        return { user: null, profile: null };
    }

    const { data: sessionData } = await authClient.auth.getSession();
    const user = sessionData.session?.user || null;

    if (!user) {
        return { user: null, profile: null };
    }

    const { data: profile } = await authClient
        .from('authors')
        .select('id,firstname,lastname,avatar,is_admin,user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    return { user, profile };
};

const setNavAuth = async () => {
    const navItems = document.querySelector('.nav__items');

    if (!navItems) {
        return;
    }

    if (!authClient) {
        navItems.innerHTML = '<li><a href="./signin.html">Signin</a></li>';
        return;
    }

    const { user, profile } = await getProfile();

    if (!user) {
        navItems.innerHTML = '<li><a href="./signin.html">Signin</a></li>';
        return;
    }

    navItems.innerHTML = `
        <li><a href="./admin.html">Dashboard</a></li>
        <li><a href="./add-post.html">Write</a></li>
        <li><a href="#" class="nav__logout">Logout</a></li>
    `;

    document.querySelector('.nav__logout')?.addEventListener('click', async (event) => {
        event.preventDefault();
        await authClient.auth.signOut();
        window.location.href = './index.html';
    });
};

setNavAuth();
