const POSTS_PER_PAGE = 9;
const app = document.querySelector('#app');
const pageName = document.body.dataset.page || 'home';
const params = new URLSearchParams(window.location.search);

const config = window.SUPABASE_CONFIG || {};
const imageBasePath = config.imageBasePath || './images/';

const state = {
    categories: [],
    authors: [],
    posts: []
};

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripHtml = (html = '') => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
};

const excerpt = (html = '', length = 150) => {
    const text = stripHtml(html).replace(/\s+/g, ' ').trim();
    return text.length > length ? `${text.slice(0, length)}...` : text;
};

const imageUrl = (fileName = '') => {
    if (String(fileName).startsWith('http')) {
        return fileName;
    }

    return `${imageBasePath}${fileName}`;
};

const formatDate = (dateValue) => new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
}).format(new Date(dateValue));

const categoryById = (id) => state.categories.find(category => Number(category.id) === Number(id));
const authorById = (id) => state.authors.find(author => Number(author.id) === Number(id));

const sortPosts = (posts) => [...posts].sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

const loadFromSupabase = async () => {
    if (!config.url || !config.anonKey || !window.supabase) {
        return null;
    }

    const client = window.supabase.createClient(config.url, config.anonKey);

    const [categoriesResult, authorsResult, postsResult] = await Promise.all([
        client.from('categories').select('id,title,description').order('title', { ascending: true }),
        client.from('authors').select('id,firstname,lastname,avatar'),
        client.from('posts').select('id,title,body,thumbnail,date_time,category_id,author_id,is_featured,is_verified').eq('is_verified', 1).order('date_time', { ascending: false })
    ]);

    if (categoriesResult.error || authorsResult.error || postsResult.error) {
        throw categoriesResult.error || authorsResult.error || postsResult.error;
    }

    return {
        categories: categoriesResult.data || [],
        authors: authorsResult.data || [],
        posts: postsResult.data || []
    };
};

const loadData = async () => {
    try {
        const supabaseData = await loadFromSupabase();
        Object.assign(state, supabaseData || window.BLOG_FALLBACK_DATA);
    } catch (error) {
        console.warn('Supabase data could not be loaded, using local fallback data.', error);
        Object.assign(state, window.BLOG_FALLBACK_DATA);
    }

    state.posts = sortPosts(state.posts.filter(post => Number(post.is_verified) === 1));
};

const renderAuthor = (post) => {
    const author = authorById(post.author_id) || {};
    const name = `${author.firstname || 'Arda'} ${author.lastname || 'Altunel'}`.trim();

    return `
        <div class="post__author">
            <div class="post__author-avatar">
                <img src="${imageUrl(author.avatar || 'images/1663704007ardaltunel-pp.png')}" alt="${escapeHtml(name)}">
            </div>
            <div class="post__author-info">
                <h5>By: ${escapeHtml(name)}</h5>
                <small>${formatDate(post.date_time)}</small>
            </div>
        </div>
    `;
};

const renderPostCard = (post) => {
    const category = categoryById(post.category_id) || { title: 'Uncategorized', id: 99 };

    return `
        <article class="post">
            <a href="./post.html?id=${post.id}">
                <div class="post__thumbnail">
                    <img src="${imageUrl(post.thumbnail)}" alt="${escapeHtml(post.title)}">
                </div>
            </a>
            <div class="post__info">
                <a href="./category.html?id=${category.id}" class="category__button">${escapeHtml(category.title)}</a>
                <h3 class="post__title">
                    <a href="./post.html?id=${post.id}">${escapeHtml(post.title)}</a>
                </h3>
                <p class="post__body">${escapeHtml(excerpt(post.body))}</p>
                ${renderAuthor(post)}
            </div>
        </article>
    `;
};

const renderCategoryButtons = () => `
    <section class="category__buttons">
        <div class="container category__buttons-container">
            ${state.categories.map(category => `
                <a href="./category.html?id=${category.id}" class="category__button">${escapeHtml(category.title)}</a>
            `).join('')}
        </div>
    </section>
`;

const renderPagination = (currentPage, totalPages) => {
    if (totalPages <= 1) {
        return '';
    }

    return `
        <div class="container pagination__container">
            ${currentPage > 1 ? `<a href="./index.html?page=${currentPage - 1}#posts" class="pagination__button">Önceki Sayfa</a>` : ''}
            <span class="pagination__status">${currentPage} / ${totalPages}</span>
            ${currentPage < totalPages ? `<a href="./index.html?page=${currentPage + 1}#posts" class="pagination__button">Sonraki Sayfa</a>` : ''}
        </div>
    `;
};

const renderHome = () => {
    const featured = state.posts.find(post => Number(post.is_featured) === 1);
    const currentPage = Math.max(1, Number(params.get('page')) || 1);
    const totalPages = Math.max(1, Math.ceil(state.posts.length / POSTS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pagePosts = state.posts.slice((safePage - 1) * POSTS_PER_PAGE, safePage * POSTS_PER_PAGE);

    app.innerHTML = `
        ${featured ? `
            <section class="featured">
                <div class="container featured__container">
                    <a href="./post.html?id=${featured.id}">
                        <div class="post__thumbnail">
                            <img src="${imageUrl(featured.thumbnail)}" alt="${escapeHtml(featured.title)}">
                        </div>
                    </a>
                    <div class="post__info">
                        <a href="./category.html?id=${featured.category_id}" class="category__button">${escapeHtml((categoryById(featured.category_id) || {}).title || 'Uncategorized')}</a>
                        <h2 class="post__title"><a href="./post.html?id=${featured.id}">${escapeHtml(featured.title)}</a></h2>
                        <p class="post__body">${escapeHtml(excerpt(featured.body, 300))}</p>
                        ${renderAuthor(featured)}
                    </div>
                </div>
            </section>
        ` : ''}
        <section class="posts ${featured ? '' : 'section__extra-margin'}" id="posts">
            <div class="container posts__container">
                ${pagePosts.map(renderPostCard).join('')}
            </div>
            ${renderPagination(safePage, totalPages)}
        </section>
        ${renderCategoryButtons()}
    `;
};

const renderPost = () => {
    const id = Number(params.get('id'));
    const post = state.posts.find(item => Number(item.id) === id);

    if (!post) {
        app.innerHTML = '<section class="empty__page"><h3>Post not found.</h3></section>';
        return;
    }

    const index = state.posts.findIndex(item => Number(item.id) === id);
    const previousPost = state.posts[index + 1] || state.posts[0];
    const nextPost = state.posts[index - 1] || state.posts[state.posts.length - 1];

    document.title = `${post.title} / Arda Altunel`;
    app.innerHTML = `
        <section class="singlepost">
            <div class="container singlepost__container" style="padding-bottom: 2rem;">
                <h2>${escapeHtml(post.title)}</h2>
                ${renderAuthor(post)}
                <div class="singlepost__thumbnail">
                    <img src="${imageUrl(post.thumbnail)}" alt="${escapeHtml(post.title)}">
                </div>
                <div id="mlinks">${post.body}</div>
                <br>
                <div class="singlepost__buttons" style="display: flex; justify-content: space-between; margin-bottom: 0; padding-bottom: 0;">
                    <a href="./post.html?id=${previousPost.id}" style="text-align: left">
                        <div style="font-size: 70%">PREVIOUS POST</div>
                        <div style="font-size: 100%">${escapeHtml(previousPost.title)}</div>
                    </a>
                    <a href="./post.html?id=${nextPost.id}" style="text-align: right">
                        <div style="font-size: 70%">NEXT POST</div>
                        <div style="font-size: 100%">${escapeHtml(nextPost.title)}</div>
                    </a>
                </div>
            </div>
        </section>
    `;

    document.querySelectorAll('#mlinks a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
};

const renderCategory = () => {
    const id = Number(params.get('id'));
    const category = categoryById(id);
    const posts = state.posts.filter(post => Number(post.category_id) === id);

    app.innerHTML = `
        <header class="category__title">
            <h2>${escapeHtml(category ? category.title : 'Category')}</h2>
        </header>
        ${posts.length ? `
            <section class="posts">
                <div class="container posts__container">
                    ${posts.map(renderPostCard).join('')}
                </div>
            </section>
        ` : `
            <div class="alert__message error lg">
                <p>No posts found for this category</p>
            </div>
        `}
        ${renderCategoryButtons()}
    `;
};

const init = async () => {
    await loadData();

    if (pageName === 'post') {
        renderPost();
    } else if (pageName === 'category') {
        renderCategory();
    } else {
        renderHome();
    }
};

init();
