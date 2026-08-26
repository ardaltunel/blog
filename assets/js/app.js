(function initializeBlog() {
    'use strict';

    const POSTS_PER_PAGE = 9;
    const MAX_CATEGORIES = 500;
    const MAX_AUTHORS = 2000;
    const MAX_POSTS = 2000;
    const MIN_PAGINATION_LOADING_MS = 900;
    const app = document.querySelector('#app');
    const declaredPageName = document.body.dataset.page || 'home';
    const pageName = declaredPageName === 'route'
        ? window.location.pathname.split('/').filter(Boolean).at(-2) === 'kategori' ? 'category' : 'post'
        : declaredPageName;
    const security = window.SecurityUtils;
    const requestedHomePage = pageName === 'home' ? security?.getQueryParam('page') : null;
    const config = security?.getSafeSupabaseConfig();
    const state = {
        categories: [],
        authors: [],
        posts: []
    };
    let paginationRevealTimer = null;

    const normalizeBoolean = value => value === true || value === 1;
    const normalizeDate = value => {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    };
    const normalizeCategory = category => {
        const id = security.toSafeId(category?.id);
        const title = security.validateText(category?.title, { min: 1, max: 100 });
        const description = security.validateText(category?.description || '', { max: 1000 });
        return id && title !== null && description !== null ? { id, title, description } : null;
    };
    const normalizeAuthor = author => {
        const id = security.toSafeId(author?.id);
        const firstname = security.validateText(author?.firstname, { min: 1, max: 80 });
        const lastname = security.validateText(author?.lastname || '', { max: 80 });
        const avatar = security.safeImageUrl(author?.avatar);
        return id && firstname !== null && lastname !== null && avatar ? { id, firstname, lastname, avatar } : null;
    };
    const normalizePost = post => {
        const id = security.toSafeId(post?.id);
        const title = security.validateText(post?.title, { min: 1, max: 160 });
        const body = typeof post?.body === 'string' && post.body.length <= 200000 ? post.body : null;
        const thumbnail = security.safeImageUrl(post?.thumbnail, security.DEFAULT_AVATAR);
        const dateTime = normalizeDate(post?.date_time);
        const categoryId = security.toSafeId(post?.category_id);
        const authorId = security.toSafeId(post?.author_id);

        if (!id || title === null || body === null || !thumbnail || !dateTime || !authorId) {
            return null;
        }

        return {
            id,
            title,
            body,
            thumbnail,
            date_time: dateTime,
            category_id: categoryId,
            author_id: authorId,
            is_featured: normalizeBoolean(post.is_featured),
            is_verified: normalizeBoolean(post.is_verified)
        };
    };
    const normalizeList = (value, limit, normalizer) => Array.isArray(value)
        ? value.slice(0, limit).map(normalizer).filter(Boolean)
        : [];
    const assignRoutes = (items, reservedSlugs = [], titleForRoute = item => item.title) => {
        const slugCounts = new Map();
        const usedSlugs = new Set(reservedSlugs);
        [...items].sort((a, b) => a.id - b.id).forEach(item => {
            const routeTitle = titleForRoute(item);
            const baseSlug = security.createSlug(routeTitle) || 'yazi';
            let duplicateIndex = (slugCounts.get(baseSlug) || 0) + 1;
            let routeSlug = security.createPostSlug(routeTitle, duplicateIndex);
            while (usedSlugs.has(routeSlug)) {
                duplicateIndex += 1;
                routeSlug = security.createPostSlug(routeTitle, duplicateIndex);
            }
            slugCounts.set(baseSlug, duplicateIndex);
            usedSlugs.add(routeSlug);
            item.route_slug = routeSlug;
            item.duplicate_index = duplicateIndex;
        });
        return items;
    };
    const applyData = source => {
        const safeSource = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        state.categories = assignRoutes(
            normalizeList(safeSource.categories, MAX_CATEGORIES, normalizeCategory),
            [],
            category => security.localizeCategoryTitle(category.title) || category.title
        );
        state.authors = normalizeList(safeSource.authors, MAX_AUTHORS, normalizeAuthor);
        state.posts = assignRoutes(normalizeList(safeSource.posts, MAX_POSTS, normalizePost)
            .filter(post => post.is_verified)
            .sort((a, b) => new Date(b.date_time) - new Date(a.date_time)), [
                'assets',
                'kategori',
                'yazi',
                'yeni-blog-ekle'
            ]);
    };

    const loadFromSupabase = async () => {
        if (!config || !window.authClient) {
            return null;
        }

        const client = window.authClient;
        const [categoriesResult, authorsResult, postsResult] = await Promise.all([
            client.from('categories').select('id,title,description').order('title', { ascending: true }).limit(MAX_CATEGORIES),
            client.from('authors').select('id,firstname,lastname,avatar').limit(MAX_AUTHORS),
            client.from('posts')
                .select('id,title,body,thumbnail,date_time,category_id,author_id,is_featured,is_verified')
                .eq('is_verified', true)
                .order('date_time', { ascending: false })
                .limit(MAX_POSTS)
        ]);

        if (categoriesResult.error || authorsResult.error || postsResult.error) {
            throw new Error('Uzak içerik yüklenemedi.');
        }

        return {
            categories: categoriesResult.data,
            authors: authorsResult.data,
            posts: postsResult.data
        };
    };

    const loadData = async () => {
        try {
            const remoteData = await loadFromSupabase();
            applyData(remoteData || window.BLOG_FALLBACK_DATA);
        } catch {
            applyData(window.BLOG_FALLBACK_DATA);
        }
    };

    const categoryById = id => state.categories.find(category => category.id === id);
    const authorById = id => state.authors.find(author => author.id === id);
    const categoryTitle = category => security.localizeCategoryTitle(category?.title) || 'Kategorisiz';
    const categoryRoute = category => category?.id
        ? security.buildRoute('category', {
            id: category.id,
            title: categoryTitle(category),
            duplicateIndex: category.duplicate_index
        })
        : security.buildRoute('home');
    const formatDate = dateValue => {
        try {
            return new Intl.DateTimeFormat('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }).format(new Date(dateValue));
        } catch {
            return '';
        }
    };
    const excerpt = (html = '', length = 150) => {
        const text = security.stripHtml(html).replace(/\s+/g, ' ').trim();
        return text.length > length ? `${text.slice(0, length)}...` : text;
    };
    const readingTime = html => {
        const words = security.stripHtml(html).trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 200));
    };
    const postRoute = post => security.buildRoute('post', {
        id: post.id,
        title: post.title,
        duplicateIndex: post.duplicate_index
    });
    const setMeta = (attribute, key, value) => {
        if (!value) {
            return;
        }
        let meta = [...document.head.querySelectorAll('meta')]
            .find(item => item.getAttribute(attribute) === key);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attribute, key);
            document.head.append(meta);
        }
        meta.content = value;
    };
    const setCanonical = value => {
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.append(link);
        }
        link.href = value;
    };
    const updatePageMetadata = ({ title, description, url, type = 'website', image = '', published = '' }) => {
        document.title = title;
        setCanonical(url);
        setMeta('name', 'description', description);
        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', description);
        setMeta('property', 'og:type', type);
        setMeta('property', 'og:url', url);
        setMeta('property', 'og:site_name', 'ARDALTUNEL');
        setMeta('property', 'og:locale', 'tr_TR');
        setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
        setMeta('name', 'twitter:title', title);
        setMeta('name', 'twitter:description', description);
        if (image) {
            setMeta('property', 'og:image', image);
            setMeta('name', 'twitter:image', image);
        }
        if (published) {
            setMeta('property', 'article:published_time', published);
        }
    };

    const renderAuthor = (post) => {
        const author = authorById(post.author_id) || {};
        const name = `${author.firstname || 'Arda'} ${author.lastname || 'Altunel'}`.trim();
        const avatar = security.safeImageUrl(author.avatar);
        return `
            <div class="post__author">
                <div class="post__author-avatar">
                    <img src="${security.escapeHtml(avatar)}" alt="${security.escapeHtml(name)}" width="46" height="46" decoding="async">
                </div>
                <div class="post__author-info">
                    <h5>${security.escapeHtml(name)}</h5>
                    <small>${security.escapeHtml(formatDate(post.date_time))}</small>
                </div>
            </div>
        `;
    };

    const renderPostCard = (post) => {
        const category = categoryById(post.category_id) || { title: 'Kategorisiz', id: null };
        const postHref = postRoute(post);
        const categoryHref = category.id ? categoryRoute(category) : security.buildRoute('home');
        return `
            <article class="post">
                <a href="${postHref}">
                    <div class="post__thumbnail">
                        <img src="${security.escapeHtml(post.thumbnail)}" alt="${security.escapeHtml(post.title)}" loading="lazy" decoding="async">
                    </div>
                </a>
                <div class="post__info">
                    <a href="${categoryHref}" class="category__button">${security.escapeHtml(categoryTitle(category))}</a>
                    <h3 class="post__title"><a href="${postHref}">${security.escapeHtml(post.title)}</a></h3>
                    <p class="post__body">${security.escapeHtml(excerpt(post.body))}</p>
                    ${renderAuthor(post)}
                </div>
            </article>
        `;
    };

    const relatedPostsFor = post => {
        const candidates = state.posts.filter(candidate => candidate.id !== post.id);
        const sameCategory = candidates.filter(candidate => candidate.category_id === post.category_id);
        const otherCategories = candidates.filter(candidate => candidate.category_id !== post.category_id);
        return [...sameCategory, ...otherCategories].slice(0, 3);
    };

    const renderRelatedPosts = post => {
        const relatedPosts = relatedPostsFor(post);
        if (!relatedPosts.length) {
            return '';
        }

        return `
            <section class="container related-posts" aria-labelledby="related-posts-title">
                <header class="related-posts__heading">
                    <div>
                        <span class="related-posts__eyebrow">OKUMAYA DEVAM ET</span>
                        <h2 id="related-posts-title">Önerilen Yazılar</h2>
                    </div>
                    <a href="${security.buildRoute('home')}#posts" class="related-posts__all">Tüm yazılar <span aria-hidden="true">&rarr;</span></a>
                </header>
                <div class="related-posts__grid">
                    ${relatedPosts.map(relatedPost => {
                        const relatedCategory = categoryById(relatedPost.category_id);
                        const relatedHref = postRoute(relatedPost);
                        return `
                            <article class="related-post">
                                <a href="${relatedHref}" class="related-post__thumbnail">
                                    <img src="${security.escapeHtml(relatedPost.thumbnail)}" alt="${security.escapeHtml(relatedPost.title)}" loading="lazy" decoding="async">
                                    <span class="related-post__category">${security.escapeHtml(categoryTitle(relatedCategory))}</span>
                                </a>
                                <div class="related-post__content">
                                    <h3><a href="${relatedHref}">${security.escapeHtml(relatedPost.title)}</a></h3>
                                    <p>${security.escapeHtml(excerpt(relatedPost.body, 105))}</p>
                                    <a href="${relatedHref}" class="related-post__meta" aria-label="${security.escapeHtml(relatedPost.title)} yazısını oku">
                                        <span>${readingTime(relatedPost.body)} dk okuma</span>
                                        <span aria-hidden="true">&rarr;</span>
                                    </a>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    };

    const renderCategoryButtons = () => `
        <section class="category__buttons">
            <div class="container category__buttons-container">
                ${state.categories.map(category => `
                    <a href="${categoryRoute(category)}" class="category__button">${security.escapeHtml(categoryTitle(category))}</a>
                `).join('')}
            </div>
        </section>
    `;

    const renderPagination = (currentPage, totalPages) => {
        if (totalPages <= 1) {
            return '';
        }

        const previous = security.buildRoute('home', { page: currentPage - 1 });
        const next = security.buildRoute('home', { page: currentPage + 1 });
        return `
            <div class="container pagination__container">
                ${currentPage > 1 ? `
                    <a href="${previous}#posts" class="pagination__button pagination__button--previous" aria-label="Önceki sayfaya git">
                        <span class="pagination__icon" aria-hidden="true">&larr;</span>
                        <span>Önceki <span class="pagination__label-suffix">sayfa</span></span>
                    </a>
                ` : ''}
                <span class="pagination__status" aria-label="${currentPage}. sayfa, toplam ${totalPages} sayfa">${currentPage} / ${totalPages}</span>
                ${currentPage < totalPages ? `
                    <a href="${next}#posts" class="pagination__button pagination__button--next" aria-label="Sonraki sayfaya git">
                        <span>Sonraki <span class="pagination__label-suffix">sayfa</span></span>
                        <span class="pagination__icon" aria-hidden="true">&rarr;</span>
                    </a>
                ` : ''}
            </div>
        `;
    };

    const scrollToRequestedPosts = () => {
        if (window.location.hash !== '#posts') {
            return;
        }
        window.requestAnimationFrame(() => {
            document.querySelector('#posts')?.scrollIntoView({ block: 'start' });
        });
    };

    const finishPaginationLoading = () => {
        const root = document.documentElement;
        if (root.dataset.paginationPending !== 'true') {
            scrollToRequestedPosts();
            return;
        }

        const startedAt = Number(root.dataset.paginationStartedAt);
        const elapsed = Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : MIN_PAGINATION_LOADING_MS;
        const remaining = Math.max(0, MIN_PAGINATION_LOADING_MS - elapsed);
        if (paginationRevealTimer !== null) {
            window.clearTimeout(paginationRevealTimer);
        }
        paginationRevealTimer = window.setTimeout(() => {
            delete root.dataset.paginationPending;
            delete root.dataset.paginationStartedAt;
            paginationRevealTimer = null;
            scrollToRequestedPosts();
        }, remaining);
    };

    const renderHome = () => {
        const featured = state.posts.find(post => post.is_featured);
        const currentPage = requestedHomePage || 1;
        const totalPages = Math.max(1, Math.ceil(state.posts.length / POSTS_PER_PAGE));
        const safePage = Math.min(currentPage, totalPages);
        const pagePosts = state.posts.slice((safePage - 1) * POSTS_PER_PAGE, safePage * POSTS_PER_PAGE);
        const homeUrl = new URL(security.buildRoute('home', safePage > 1 ? { page: safePage } : {}), window.location.href);
        if (`${window.location.pathname}${window.location.search}` !== `${homeUrl.pathname}${homeUrl.search}`) {
            window.history.replaceState(null, '', `${homeUrl.pathname}${homeUrl.search}${window.location.hash}`);
        }
        const homeTitle = safePage > 1 ? `Blog Yazıları – Sayfa ${safePage} | Arda Altunel` : 'Blog Yazıları | Arda Altunel';
        updatePageMetadata({
            title: homeTitle,
            description: 'Arda Altunel’in yazılım, teknoloji, tasarım, bilim ve yaşam üzerine blog yazıları.',
            url: homeUrl.href,
            image: state.posts[0]?.thumbnail || ''
        });

        security.renderUi(app, `
            ${featured ? `
                <section class="featured">
                    <div class="container featured__container">
                        <a href="${postRoute(featured)}">
                            <div class="post__thumbnail">
                                <img src="${security.escapeHtml(featured.thumbnail)}" alt="${security.escapeHtml(featured.title)}" decoding="async" fetchpriority="high">
                            </div>
                        </a>
                        <div class="post__info">
                            <a href="${categoryRoute(categoryById(featured.category_id))}" class="category__button">${security.escapeHtml(categoryTitle(categoryById(featured.category_id)))}</a>
                            <h2 class="post__title"><a href="${postRoute(featured)}">${security.escapeHtml(featured.title)}</a></h2>
                            <p class="post__body">${security.escapeHtml(excerpt(featured.body, 300))}</p>
                            ${renderAuthor(featured)}
                        </div>
                    </div>
                </section>
            ` : ''}
            <section class="posts posts--home ${featured ? '' : 'section__extra-margin'}" id="posts">
                <div class="pagination__loading" role="status" aria-live="polite" aria-label="Yazılar yükleniyor">
                    <span class="pagination__loading-spinner" aria-hidden="true"></span>
                    <span class="pagination__loading-copy"><span class="pagination__loading-title">Yazılar yükleniyor...</span><small>Gönderiler hazırlanıyor</small></span>
                </div>
                <div class="container posts__container">${pagePosts.map(renderPostCard).join('')}</div>
                ${renderPagination(safePage, totalPages)}
            </section>
            ${renderCategoryButtons()}
        `);
        finishPaginationLoading();
    };

    const renderNotFound = () => {
        const title = 'Sayfa Bulunamadı | Arda Altunel';
        const description = 'Aradığınız sayfa taşınmış, kaldırılmış veya hiç var olmamış olabilir.';
        document.title = title;
        setMeta('name', 'description', description);
        setMeta('name', 'robots', 'noindex,follow');
        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', description);
        security.renderUi(app, `
            <section class="not-found">
                <div class="container not-found__container">
                    <div class="not-found__visual" aria-hidden="true">
                        <span class="not-found__code">404</span>
                    </div>
                    <div class="not-found__content">
                        <span class="not-found__eyebrow">ROTA BULUNAMADI</span>
                        <h1>Aradığın sayfa burada değil.</h1>
                        <p>Bağlantı taşınmış, kaldırılmış veya adres yanlış yazılmış olabilir. Dilersen ana sayfaya dönebilir ya da son yazılara göz atabilirsin.</p>
                        <div class="not-found__actions">
                            <a class="btn not-found__button" href="${security.buildRoute('home')}">Ana sayfaya dön</a>
                            <a class="not-found__secondary" href="${security.buildRoute('home')}#posts">Yazılara göz at <span aria-hidden="true">→</span></a>
                        </div>
                    </div>
                </div>
            </section>
        `);
    };

    const renderSafeError = (message) => {
        if (message === 'Yazı bulunamadı.' || message === 'Kategori bulunamadı.') {
            renderNotFound();
            return;
        }
        security.renderUi(app, '<section class="empty__page"><h3></h3></section>');
        const heading = app.querySelector('h3');
        if (heading) {
            heading.textContent = message;
        }
    };

    const renderPost = () => {
        const id = security.getPostId();
        const requestedSlug = security.getPostSlug();
        const post = id
            ? state.posts.find(item => item.id === id)
            : state.posts.find(item => item.route_slug === requestedSlug);
        if (!post) {
            renderSafeError('Yazı bulunamadı.');
            return;
        }

        const index = state.posts.findIndex(item => item.id === post.id);
        const previousPost = state.posts[index + 1] || state.posts[0];
        const nextPost = state.posts[index - 1] || state.posts[state.posts.length - 1];
        const category = categoryById(post.category_id) || { title: 'Genel', id: null };
        const categoryHref = category.id
            ? categoryRoute(category)
            : security.buildRoute('home');
        const canonicalPath = postRoute(post);
        const canonicalUrl = new URL(canonicalPath, window.location.href);
        if (`${window.location.pathname}${window.location.search}` !== `${canonicalUrl.pathname}${canonicalUrl.search}`) {
            window.history.replaceState(null, '', `${canonicalUrl.pathname}${canonicalUrl.search}${window.location.hash}`);
        }
        updatePageMetadata({
            title: `${post.title} | Arda Altunel`,
            description: excerpt(post.body, 155),
            url: canonicalUrl.href,
            type: 'article',
            image: post.thumbnail,
            published: post.date_time
        });
        security.renderUi(app, `
            <section class="singlepost">
                <article class="container singlepost__container">
                    <div class="singlepost__hero">
                        <figure class="singlepost__thumbnail">
                            <img src="${security.escapeHtml(post.thumbnail)}" alt="${security.escapeHtml(post.title)}" decoding="async" fetchpriority="high">
                        </figure>
                        <div class="singlepost__hero-shade"></div>
                        <header class="singlepost__header">
                            <div class="singlepost__eyebrow">
                                <a href="${categoryHref}" class="category__button">${security.escapeHtml(categoryTitle(category))}</a>
                                <span>${readingTime(post.body)} dk okuma</span>
                            </div>
                            <h1>${security.escapeHtml(post.title)}</h1>
                            ${renderAuthor(post)}
                        </header>
                    </div>
                    <div class="singlepost__body">
                        <div id="post-content" class="article-content"></div>
                        <div class="singlepost__buttons">
                        <a href="${postRoute(previousPost)}" class="singlepost__previous">
                            <div class="singlepost__button-label">ÖNCEKİ YAZI</div>
                            <div>${security.escapeHtml(previousPost.title)}</div>
                        </a>
                        <a href="${postRoute(nextPost)}" class="singlepost__next">
                            <div class="singlepost__button-label">SONRAKİ YAZI</div>
                            <div>${security.escapeHtml(nextPost.title)}</div>
                        </a>
                        </div>
                    </div>
                </article>
                ${renderRelatedPosts(post)}
            </section>
        `);
        const content = app.querySelector('#post-content');
        content?.append(security.sanitizeBlogFragment(post.body));
        globalThis.ContentEnhancements?.enhance(content);
    };

    const renderCategory = () => {
        const id = security.getQueryParam('id');
        const requestedSlug = security.getCategorySlug();
        const category = id
            ? categoryById(id)
            : state.categories.find(item => item.route_slug === requestedSlug);
        if (!category) {
            renderSafeError('Kategori bulunamadı.');
            return;
        }

        const posts = state.posts.filter(post => post.category_id === category.id);
        const canonicalUrl = new URL(categoryRoute(category), window.location.href);
        if (`${window.location.pathname}${window.location.search}` !== `${canonicalUrl.pathname}${canonicalUrl.search}`) {
            window.history.replaceState(null, '', canonicalUrl.pathname);
        }
        updatePageMetadata({
            title: `${categoryTitle(category)} Yazıları | Arda Altunel`,
            description: category.description || `${categoryTitle(category)} kategorisindeki blog yazıları.`,
            url: canonicalUrl.href,
            image: posts[0]?.thumbnail || ''
        });
        security.renderUi(app, `
            <header class="category__title"><h2>${security.escapeHtml(categoryTitle(category))}</h2></header>
            ${posts.length ? `
                <section class="posts">
                    <div class="container posts__container">${posts.map(renderPostCard).join('')}</div>
                </section>
            ` : `
                <div class="alert__message error lg"><p>Bu kategoride henüz yazı bulunmuyor.</p></div>
            `}
            ${renderCategoryButtons()}
        `);
    };

    const renderCurrentPage = () => {
        if (pageName === 'post') {
            renderPost();
        } else if (pageName === 'category') {
            renderCategory();
        } else {
            renderHome();
        }
    };

    const init = async () => {
        if (!app || !security) {
            return;
        }

        try {
            let initialHomeState = null;
            if (requestedHomePage && requestedHomePage > 1 && window.BLOG_FALLBACK_DATA) {
                applyData(window.BLOG_FALLBACK_DATA);
                initialHomeState = JSON.stringify(state);
                renderHome();
            }

            await loadData();
            if (initialHomeState === null || JSON.stringify(state) !== initialHomeState) {
                renderCurrentPage();
            }
        } catch {
            renderSafeError('İçerik yüklenemedi.');
            delete document.documentElement.dataset.paginationPending;
            delete document.documentElement.dataset.paginationStartedAt;
        }
    };

    init();
}());
