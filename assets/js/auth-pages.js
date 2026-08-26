(function initializeAuthPages() {
    'use strict';

    const security = window.SecurityUtils;
    const client = window.authClient;
    const config = window.authConfig;
    const authErrorMessages = window.AuthErrorMessages;
    const authSessionManager = window.authSessionManager;
    const getCurrentProfile = window.getProfile;
    const messageBox = document.querySelector('#auth-message');
    const editPostModal = document.querySelector('#edit-post-modal');
    const editPostPanel = document.querySelector('#edit-post-panel');
    const editPostMessage = document.querySelector('#edit-post-message');
    const editPostCloseButton = document.querySelector('#close-edit-post-modal');
    let activeEditor = null;
    let editPostEditor = null;
    let editPostRequestId = 0;
    let editPostTrigger = null;

    const showMessage = (message, type = 'error') => {
        if (!messageBox) {
            return;
        }
        messageBox.hidden = false;
        messageBox.className = `alert__message ${type === 'success' ? 'success' : 'error'}`;
        messageBox.textContent = String(message).slice(0, 300);
    };
    const clearMessage = () => {
        if (messageBox) {
            messageBox.hidden = true;
            messageBox.textContent = '';
        }
    };
    const showEditPostMessage = message => {
        if (editPostMessage) {
            editPostMessage.hidden = false;
            editPostMessage.textContent = String(message).slice(0, 300);
        }
    };
    const clearEditPostMessage = () => {
        if (editPostMessage) {
            editPostMessage.hidden = true;
            editPostMessage.textContent = '';
        }
    };
    const destroyEditPostEditor = async () => {
        if (!editPostEditor) {
            return;
        }
        const editor = editPostEditor;
        editPostEditor = null;
        await editor.destroy();
    };
    const closeEditPostModal = async () => {
        if (!editPostModal || editPostModal.hidden) {
            return;
        }
        editPostRequestId += 1;
        editPostModal.hidden = true;
        document.body.classList.remove('modal-open');
        clearEditPostMessage();
        await destroyEditPostEditor();
        editPostPanel?.replaceChildren();
        if (editPostTrigger?.isConnected) {
            editPostTrigger.focus();
        } else {
            document.querySelector('#dashboard-title')?.focus?.();
        }
        editPostTrigger = null;
    };
    const openEditPostModal = trigger => {
        if (!editPostModal || !editPostPanel) {
            return false;
        }
        editPostTrigger = trigger || null;
        clearEditPostMessage();
        security.renderUi(editPostPanel, '<p class="dashboard__modal-loading">Düzenleyici yükleniyor...</p>');
        editPostModal.hidden = false;
        document.body.classList.add('modal-open');
        editPostCloseButton?.focus();
        return true;
    };
    const handleEditPostModalKeydown = event => {
        if (!editPostModal || editPostModal.hidden) {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            void closeEditPostModal();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const focusable = Array.from(editPostModal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
        )).filter(element => !element.hidden && element.getClientRects().length > 0);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    editPostCloseButton?.addEventListener('click', () => void closeEditPostModal());
    editPostModal?.addEventListener('click', event => {
        if (event.target === editPostModal) {
            void closeEditPostModal();
        }
    });
    document.addEventListener('keydown', handleEditPostModalKeydown);
    const requireSupabase = () => {
        if (!client || !config) {
            showMessage('Hizmet geçici olarak kullanılamıyor.');
            return false;
        }
        return true;
    };
    const safeId = value => security.toSafeId(value);
    const categoryTitle = value => security.localizeCategoryTitle(value);
    const readName = value => security.validateText(value, { min: 1, max: 80 });
    const readTitle = value => security.validateText(value, { min: 1, max: 160 });
    const setSubmitting = (button, disabled, label) => {
        if (button) {
            button.disabled = disabled;
            button.textContent = label;
        }
    };
    const setupPasswordToggles = form => {
        form.querySelectorAll('.password__toggle').forEach(toggle => {
            const inputId = toggle.getAttribute('aria-controls');
            const input = inputId ? form.querySelector(`#${inputId}`) : null;
            toggle.addEventListener('click', () => {
                const isVisible = input?.type === 'text';
                if (input) {
                    input.type = isVisible ? 'password' : 'text';
                }
                toggle.textContent = isVisible ? 'Göster' : 'Gizle';
                toggle.setAttribute('aria-pressed', String(!isVisible));
            });
        });
    };
    const getBody = (editor, fallback = '') => {
        const raw = editor ? editor.getData() : String(fallback || '');
        const sanitized = security.sanitizeBlogHtml(raw).trim();
        const text = security.stripHtml(sanitized).trim();
        return text && sanitized.length <= 200000 ? sanitized : null;
    };
    const cleanupUpload = async path => {
        if (!path || !client || !config) {
            return;
        }
        await client.storage.from(config.storageBucket).remove([path]);
    };
    const uploadImage = async (file, userId, kind, maxBytes) => {
        const validated = security.validateImageFile(file, maxBytes);
        if (!validated) {
            throw new Error('INVALID_IMAGE');
        }
        if (!await security.hasValidImageSignature(validated.file, validated.extension)) {
            throw new Error('INVALID_IMAGE_CONTENT');
        }
        const path = security.createUploadPath(userId, kind, validated.extension);
        if (!path) {
            throw new Error('INVALID_UPLOAD_PATH');
        }
        const { error } = await client.storage.from(config.storageBucket).upload(path, validated.file, {
            cacheControl: '3600',
            contentType: validated.file.type,
            upsert: false
        });
        if (error) {
            throw new Error('UPLOAD_FAILED');
        }
        const { data } = client.storage.from(config.storageBucket).getPublicUrl(path);
        const publicUrl = security.safeImageUrl(data?.publicUrl, '');
        if (!publicUrl) {
            await cleanupUpload(path);
            throw new Error('UPLOAD_FAILED');
        }
        return { path, publicUrl };
    };
    const createEditor = (element) => {
        if (!window.SafeRichEditor?.create) {
            throw new Error('EDITOR_UNAVAILABLE');
        }
        return window.SafeRichEditor.create(element);
    };

    const setupSignin = () => {
        const form = document.querySelector('#signin-form');
        if (!form) {
            return;
        }
        const rememberInput = form.querySelector('input[name="remember"]');
        if (rememberInput) {
            rememberInput.checked = authSessionManager?.isRemembered() === true;
            rememberInput.disabled = authSessionManager?.canRemember() === false;
        }
        setupPasswordToggles(form);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            if (!requireSupabase()) {
                return;
            }
            const formData = new FormData(form);
            const email = security.validateEmail(formData.get('email'));
            const password = security.validatePassword(formData.get('password'));
            const rememberMe = formData.get('remember') === '1';
            if (!email || !password) {
                showMessage('Geçerli bir e-posta adresi ve 8–128 karakter uzunluğunda bir şifre girin.');
                return;
            }
            if (rememberMe && authSessionManager?.setRememberMe(true) !== true) {
                showMessage('Bu tarayıcı kalıcı oturum saklamayı desteklemiyor.');
                return;
            }
            if (!rememberMe) {
                authSessionManager?.setRememberMe(false);
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Giriş yapılıyor...');
            try {
                const { error } = await client.auth.signInWithPassword({ email, password });
                if (error) {
                    showMessage('E-posta veya şifre hatalı.');
                    return;
                }
                security.navigate('admin');
            } catch {
                showMessage('Giriş tamamlanamadı. Lütfen tekrar deneyin.');
            } finally {
                setSubmitting(button, false, 'Giriş yap');
            }
        });
    };

    const setupSignup = () => {
        const form = document.querySelector('#signup-form');
        if (!form) {
            return;
        }
        setupPasswordToggles(form);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            if (!requireSupabase()) {
                return;
            }
            const formData = new FormData(form);
            const firstname = readName(formData.get('firstname'));
            const lastname = readName(formData.get('lastname'));
            const email = security.validateEmail(formData.get('email'));
            const password = security.validatePassword(formData.get('password'));
            const passwordConfirmation = security.validatePassword(formData.get('password_confirmation'));
            const avatarFile = formData.get('avatar');
            const hasAvatar = avatarFile && avatarFile.name;
            if (!firstname || !lastname || !email || !password || !passwordConfirmation) {
                showMessage('Ad, soyad, e-posta ve şifre alanlarını kontrol edin. Şifre 8–128 karakter uzunluğunda olmalıdır.');
                return;
            }
            if (!Object.is(password, passwordConfirmation)) {
                showMessage('Şifreler eşleşmiyor. Lütfen iki alana da aynı şifreyi girin.');
                return;
            }
            if (hasAvatar && !security.validateImageFile(avatarFile, 2 * 1024 * 1024)) {
                showMessage('Profil fotoğrafı PNG, JPEG veya WebP biçiminde ve en fazla 2 MB olmalıdır.');
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Hesap oluşturuluyor...');
            let uploadedPath = null;
            try {
                const emailRedirectTo = new URL(
                    security.buildRoute('admin', { view: 'profile' }),
                    window.location.href
                ).href;
                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: { data: { firstname, lastname }, emailRedirectTo }
                });
                if (error || !data.user) {
                    showMessage(authErrorMessages?.signup(error)
                        || 'Hesap oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.');
                    return;
                }

                let avatarUploaded = false;
                if (hasAvatar && data.session?.user?.id === data.user.id) {
                    const upload = await uploadImage(avatarFile, data.user.id, 'avatars', 2 * 1024 * 1024);
                    uploadedPath = upload.path;
                    const { data: updated, error: profileError } = await client
                        .from('authors')
                        .update({ avatar: upload.publicUrl })
                        .eq('user_id', data.user.id)
                        .select('id');
                    if (profileError || !updated?.length) {
                        await cleanupUpload(uploadedPath);
                        uploadedPath = null;
                        throw new Error('PROFILE_UPDATE_FAILED');
                    }
                    avatarUploaded = true;
                }

                const suffix = hasAvatar && !avatarUploaded
                    ? ' E-postanızı doğruladıktan sonra profil fotoğrafınızı Profil sayfasından yeniden seçin.'
                    : '';
                showMessage(`Hesabınız oluşturuldu. E-posta doğrulaması etkinse gelen kutunuzu kontrol edin.${suffix}`, 'success');
                form.reset();
            } catch {
                await cleanupUpload(uploadedPath);
                showMessage('Hesap kurulumu tamamlanamadı. Lütfen tekrar deneyin.');
            } finally {
                setSubmitting(button, false, 'Kayıt ol');
            }
        });
    };

    const loadCategoriesIntoSelect = async () => {
        const select = document.querySelector('#category-select');
        if (!select || !client) {
            return;
        }
        const { data, error } = await client.from('categories').select('id,title').order('title').limit(500);
        if (error || !Array.isArray(data)) {
            showMessage('Kategoriler yüklenemedi.');
            return;
        }
        const options = data.map(category => {
            const id = safeId(category.id);
            const title = security.validateText(category.title, { min: 1, max: 100 });
            if (!id || !title) {
                return null;
            }
            const option = document.createElement('option');
            option.value = String(id);
            option.textContent = categoryTitle(title);
            return option;
        }).filter(Boolean);
        select.replaceChildren(...options);
    };

    const setupEditor = () => {
        const element = document.querySelector('#editor');
        if (!element) {
            return;
        }
        try {
            activeEditor = createEditor(element);
        } catch {
            showMessage('Düzenleyici yüklenemedi.');
        }
    };

    const setupAddPost = async () => {
        const form = document.querySelector('#add-post-form');
        if (!form || !requireSupabase()) {
            return;
        }
        let profileResult;
        try {
            profileResult = await getCurrentProfile();
        } catch {
            profileResult = { user: null, profile: null };
        }
        const { user, profile } = profileResult;
        if (!user || !profile) {
            security.navigate('signin');
            return;
        }
        await loadCategoriesIntoSelect();
        form.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const formData = new FormData(form);
            const title = readTitle(formData.get('title'));
            const body = getBody(activeEditor, formData.get('body'));
            const categoryId = safeId(formData.get('category'));
            const thumbnailFile = formData.get('thumbnail');
            if (!title || !body || !categoryId) {
                showMessage('Yazı başlığı, kategori ve içerik alanları zorunludur.');
                return;
            }
            if (!security.validateImageFile(thumbnailFile, 5 * 1024 * 1024)) {
                showMessage('Kapak görseli PNG, JPEG veya WebP biçiminde ve en fazla 5 MB olmalıdır.');
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Gönderiliyor...');
            let uploadedPath = null;
            try {
                const upload = await uploadImage(thumbnailFile, user.id, 'posts', 5 * 1024 * 1024);
                uploadedPath = upload.path;
                const { error } = await client.from('posts').insert({
                    title,
                    body,
                    thumbnail: upload.publicUrl,
                    category_id: categoryId,
                    author_id: profile.id,
                    is_featured: false,
                    is_verified: false
                });
                if (error) {
                    await cleanupUpload(uploadedPath);
                    uploadedPath = null;
                    throw new Error('POST_INSERT_FAILED');
                }
                showMessage('Yazı yönetici incelemesine gönderildi.', 'success');
                form.reset();
                activeEditor?.setData('');
            } catch {
                await cleanupUpload(uploadedPath);
                showMessage('Yazı gönderilemedi. Lütfen tekrar deneyin.');
            } finally {
                setSubmitting(button, false, 'İncelemeye gönder');
            }
        });
    };

    const renderDashboard = async () => {
        const container = document.querySelector('#dashboard-content');
        const title = document.querySelector('#dashboard-title');
        if (!container || !requireSupabase()) {
            return;
        }
        let profileResult;
        try {
            profileResult = await getCurrentProfile();
        } catch {
            profileResult = { user: null, profile: null };
        }
        const { user, profile } = profileResult;
        if (!user || !profile) {
            security.navigate('signin');
            return;
        }
        document.querySelectorAll('[data-admin-only]').forEach(item => {
            item.hidden = !profile.is_admin;
        });
        const requestedView = security.getQueryParam('view') || 'my-posts';
        const safeView = profile.is_admin ? requestedView : 'my-posts';
        document.querySelectorAll('[data-view-link]').forEach(link => {
            link.classList.toggle('active', link.dataset.viewLink === safeView);
        });
        const refresh = () => renderDashboard();
        const adminOnly = () => {
            if (profile.is_admin) {
                return true;
            }
            title.textContent = 'Yazılarım';
            security.renderUi(container, '<div class="alert__message error">Bu sayfayı yalnızca yöneticiler görüntüleyebilir.</div>');
            return false;
        };

        if (safeView === 'profile') {
            title.textContent = 'Profil';
            renderProfile(container, user, profile, refresh);
            return;
        }

        if (safeView === 'add-user') {
            if (adminOnly()) {
                title.textContent = 'Kullanıcı ekle';
                renderAddUser(container);
            }
            return;
        }
        if (safeView === 'manage-users') {
            if (adminOnly()) {
                title.textContent = 'Kullanıcıları yönet';
                await renderManageUsers(container, profile, refresh);
            }
            return;
        }
        if (safeView === 'add-category') {
            if (adminOnly()) {
                title.textContent = 'Kategori ekle';
                renderAddCategory(container, refresh);
            }
            return;
        }
        if (safeView === 'manage-categories') {
            if (adminOnly()) {
                title.textContent = 'Kategorileri yönet';
                await renderManageCategories(container, refresh);
            }
            return;
        }
        title.textContent = safeView === 'all-posts' ? 'Tüm yazılar' : 'Yazılarım';
        await renderPostsTable(container, profile, safeView, refresh);
    };

    const renderProfile = (container, user, profile, refresh) => {
        security.renderUi(container, `
            <div class="form__section-container dashboard__profile-editor">
                <div class="dashboard__profile-avatar"><img src="${security.escapeHtml(profile.avatar)}" alt="${security.escapeHtml(profile.firstname)}"></div>
                <form id="profile-avatar-form">
                    <label for="profile-avatar">Profil fotoğrafı</label>
                    <input type="file" name="avatar" id="profile-avatar" accept="image/png,image/jpeg,image/webp" required>
                    <button type="submit" class="btn">Fotoğrafı güncelle</button>
                </form>
            </div>
        `);
        container.querySelector('#profile-avatar-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const form = event.currentTarget;
            const file = new FormData(form).get('avatar');
            if (!security.validateImageFile(file, 2 * 1024 * 1024)) {
                showMessage('Profil fotoğrafı PNG, JPEG veya WebP biçiminde ve en fazla 2 MB olmalıdır.');
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Yükleniyor...');
            let uploadedPath = null;
            try {
                const upload = await uploadImage(file, user.id, 'avatars', 2 * 1024 * 1024);
                uploadedPath = upload.path;
                const { data: updated, error } = await client.from('authors')
                    .update({ avatar: upload.publicUrl })
                    .eq('id', profile.id)
                    .eq('user_id', user.id)
                    .select('id');
                if (error || !updated?.length) {
                    throw new Error('PROFILE_UPDATE_FAILED');
                }
                uploadedPath = null;
                showMessage('Profil fotoğrafı güncellendi.', 'success');
                await refresh();
            } catch {
                await cleanupUpload(uploadedPath);
                showMessage('Profil fotoğrafı güncellenemedi. Lütfen tekrar deneyin.');
            } finally {
                setSubmitting(button, false, 'Fotoğrafı güncelle');
            }
        });
    };

    const renderPostsTable = async (container, profile, view, refresh) => {
        const columns = profile.is_admin
            ? 'id,title,body,thumbnail,date_time,is_verified,category_id,author_id,authors(firstname,lastname),categories(title)'
            : 'id,title,body,thumbnail,date_time,is_verified,category_id,categories(title)';
        let query = client.from('posts').select(columns).order('date_time', { ascending: false }).limit(1000);
        if (!profile.is_admin || view !== 'all-posts') {
            query = query.eq('author_id', profile.id);
        }
        const { data, error } = await query;
        if (error || !Array.isArray(data)) {
            showMessage('Yazılar yüklenemedi.');
            return;
        }
        const posts = data.map(post => {
            const id = safeId(post.id);
            const title = readTitle(post.title);
            if (!id || !title) {
                return null;
            }
            return {
                id,
                title,
                is_verified: post.is_verified === true,
                categoryTitle: categoryTitle(security.validateText(post.categories?.title || '', { max: 100 }) || ''),
                authorName: security.validateText(
                    post.authors ? `${post.authors.firstname || ''} ${post.authors.lastname || ''}`.trim() : '',
                    { max: 161 }
                ) || ''
            };
        }).filter(Boolean);
        const isAdminTable = profile.is_admin === true;
        const showsAuthor = isAdminTable && view === 'all-posts';
        security.renderUi(container, `
            <div class="dashboard__table-scroll">
            <table class="dashboard__table dashboard__table--posts${isAdminTable ? ' dashboard__table--admin-posts' : ''}${showsAuthor ? ' dashboard__table--with-author' : ''}">
                <thead><tr>
                    <th scope="col">Başlık</th><th scope="col">Kategori</th>
                    ${showsAuthor ? '<th scope="col">Yazar</th>' : ''}
                    <th scope="col">Düzenle</th>${profile.is_admin ? '<th scope="col">Yayın durumu</th><th scope="col">Sil</th>' : ''}
                </tr></thead>
                <tbody>${posts.map(post => `
                    <tr>
                        <td class="dashboard__post-title" data-label="Başlık">${security.escapeHtml(post.title)}</td>
                        <td class="dashboard__post-category" data-label="Kategori">${security.escapeHtml(post.categoryTitle)}</td>
                        ${showsAuthor ? `<td class="dashboard__post-author" data-label="Yazar">${security.escapeHtml(post.authorName)}</td>` : ''}
                        <td class="dashboard__post-action" data-label="Düzenle"><button type="button" class="btn sm edit-post" data-id="${post.id}">Düzenle</button></td>
                        ${profile.is_admin ? `
                            <td class="dashboard__post-action" data-label="Yayın durumu"><button type="button" class="btn sm toggle-post" data-id="${post.id}" data-verified="${post.is_verified === true}">${post.is_verified === true ? 'Yayından kaldır' : 'Yayınla'}</button></td>
                            <td class="dashboard__post-action" data-label="Sil"><button type="button" class="btn sm danger delete-post" data-id="${post.id}">Sil</button></td>
                        ` : ''}
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        `);

        container.querySelectorAll('.toggle-post').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const nextValue = button.dataset.verified !== 'true';
                const { data: updated, error: updateError } = await client.from('posts')
                    .update({ is_verified: nextValue }).eq('id', id).select('id');
                if (updateError || !updated?.length) {
                    showMessage('Yazının yayın durumu güncellenemedi.');
                    button.disabled = false;
                    return;
                }
                await refresh();
            });
        });
        container.querySelectorAll('.delete-post').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Bu yazıyı silmek istediğinizden emin misiniz?')) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const { data: deleted, error: deleteError } = await client.from('posts')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Yazı silinemedi.');
                    button.disabled = false;
                    return;
                }
                await refresh();
            });
        });
        container.querySelectorAll('.edit-post').forEach(button => {
            button.addEventListener('click', () => renderEditPostPanel(safeId(button.dataset.id), refresh, button));
        });
    };

    const renderEditPostPanel = async (postId, refresh, trigger) => {
        if (!editPostPanel || !postId) {
            return;
        }
        await destroyEditPostEditor();
        if (!openEditPostModal(trigger)) {
            return;
        }
        const requestId = ++editPostRequestId;
        const [postResult, categoryResult] = await Promise.all([
            client.from('posts').select('id,title,body,category_id').eq('id', postId).maybeSingle(),
            client.from('categories').select('id,title').order('title').limit(500)
        ]);
        if (requestId !== editPostRequestId || editPostModal?.hidden) {
            return;
        }
        if (postResult.error || categoryResult.error || !postResult.data || !Array.isArray(categoryResult.data)) {
            editPostPanel.replaceChildren();
            showEditPostMessage('Yazı düzenleyicisi yüklenemedi.');
            return;
        }
        const postTitle = readTitle(postResult.data.title);
        const body = security.sanitizeBlogHtml(postResult.data.body || '');
        const categoryId = safeId(postResult.data.category_id);
        const categories = categoryResult.data.map(category => ({
            id: safeId(category.id),
            title: security.validateText(category.title, { min: 1, max: 100 })
        })).filter(category => category.id && category.title);
        if (!postTitle || body.length > 200000) {
            editPostPanel.replaceChildren();
            showEditPostMessage('Yazı verileri geçersiz.');
            return;
        }
        security.renderUi(editPostPanel, `
            <div class="form__section-container dashboard__editor">
                <form id="edit-post-form">
                    <div class="form__control">
                        <label for="edit-post-title">Yazı başlığı</label>
                        <input type="text" id="edit-post-title" name="title" maxlength="160" value="${security.escapeHtml(postTitle)}" required>
                    </div>
                    <div class="form__control">
                        <label for="edit-post-category">Kategori</label>
                        <select id="edit-post-category" name="category" required>${categories.map(category => `
                        <option value="${category.id}" ${category.id === categoryId ? 'selected' : ''}>${security.escapeHtml(categoryTitle(category.title))}</option>
                        `).join('')}</select>
                    </div>
                    <div class="form__control">
                        <label for="edit-editor">Yazı içeriği</label>
                        <textarea name="body" id="edit-editor" rows="10" maxlength="200000" required>${security.escapeHtml(body)}</textarea>
                    </div>
                    <button type="submit" class="btn">Değişiklikleri kaydet</button>
                </form>
            </div>
        `);
        const editorElement = editPostPanel.querySelector('#edit-editor');
        try {
            editPostEditor = createEditor(editorElement);
            editPostEditor.setData(body);
        } catch {
            editPostPanel.replaceChildren();
            showEditPostMessage('Düzenleyici yüklenemedi.');
            return;
        }
        editPostPanel.querySelector('#edit-post-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearEditPostMessage();
            const formData = new FormData(event.currentTarget);
            const title = readTitle(formData.get('title'));
            const updatedBody = getBody(editPostEditor, formData.get('body'));
            const updatedCategoryId = safeId(formData.get('category'));
            if (!title || !updatedBody || !updatedCategoryId) {
                showEditPostMessage('Yazı başlığı, kategori ve içerik alanları zorunludur.');
                return;
            }
            const button = event.currentTarget.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Kaydediliyor...');
            const { data: updated, error } = await client.from('posts').update({
                title,
                body: updatedBody,
                category_id: updatedCategoryId
            }).eq('id', postId).select('id');
            if (error || !updated?.length) {
                showEditPostMessage('Yazı güncellenemedi.');
                setSubmitting(button, false, 'Değişiklikleri kaydet');
                return;
            }
            showMessage('Yazı güncellendi.', 'success');
            await refresh();
            await closeEditPostModal();
        });
    };

    const renderAddUser = container => {
        security.renderUi(container, `
            <form id="admin-add-user-form">
                <input type="text" name="firstname" maxlength="80" placeholder="Ad" required>
                <input type="text" name="lastname" maxlength="80" placeholder="Soyad" required>
                <input type="email" name="email" maxlength="254" placeholder="E-posta" required>
                <input type="password" name="password" minlength="8" maxlength="128" placeholder="Şifre" required>
                <div class="form__control inline">
                    <input type="checkbox" name="is_admin" value="1" id="new_user_admin">
                    <label for="new_user_admin">Yönetici yetkisi ver</label>
                </div>
                <button type="submit" class="btn">Kullanıcı ekle</button>
            </form>
        `);
        container.querySelector('#admin-add-user-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const formData = new FormData(event.currentTarget);
            const firstname = readName(formData.get('firstname'));
            const lastname = readName(formData.get('lastname'));
            const email = security.validateEmail(formData.get('email'));
            const password = security.validatePassword(formData.get('password'));
            if (!firstname || !lastname || !email || !password) {
                showMessage('Ad, soyad, e-posta ve şifre alanlarını kontrol edin.');
                return;
            }
            const button = event.currentTarget.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Ekleniyor...');
            try {
                const isolatedClient = window.supabase.createClient(config.url, config.anonKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false,
                        storageKey: 'sb-isolated-admin-create-user'
                    }
                });
                const { data, error } = await isolatedClient.auth.signUp({
                    email,
                    password,
                    options: { data: { firstname, lastname } }
                });
                if (error || !data.user) {
                    showMessage('Kullanıcı oluşturulamadı.');
                    return;
                }
                if (formData.get('is_admin')) {
                    const { data: updated, error: roleError } = await client.from('authors')
                        .update({ is_admin: true }).eq('user_id', data.user.id).select('id');
                    if (roleError || !updated?.length) {
                        showMessage('Kullanıcı oluşturuldu ancak yönetici yetkisi verilemedi.');
                        return;
                    }
                }
                showMessage('Kullanıcı oluşturuldu. E-posta doğrulaması gerekebilir.', 'success');
                event.currentTarget.reset();
            } catch {
                showMessage('Kullanıcı oluşturulamadı.');
            } finally {
                setSubmitting(button, false, 'Kullanıcı ekle');
            }
        });
    };

    const renderManageUsers = async (container, currentProfile, refresh) => {
        const { data, error } = await client.from('authors')
            .select('id,firstname,lastname,avatar,is_admin,user_id').order('id', { ascending: false }).limit(2000);
        if (error || !Array.isArray(data)) {
            showMessage('Kullanıcı profilleri yüklenemedi.');
            return;
        }
        const users = data.map(user => {
            const id = safeId(user.id);
            const firstname = readName(user.firstname);
            const lastname = security.validateText(user.lastname || '', { max: 80 });
            if (!id || !firstname || lastname === null || !security.validateUuid(user.user_id)) {
                return null;
            }
            return {
                id,
                userId: user.user_id,
                name: `${firstname} ${lastname}`.trim(),
                avatar: security.safeImageUrl(user.avatar),
                isAdmin: user.is_admin === true,
                isCurrent: id === currentProfile.id
            };
        }).filter(Boolean);
        security.renderUi(container, `
            <div class="dashboard__table-scroll">
            <table class="dashboard__table dashboard__table--users">
                <thead><tr><th scope="col">Fotoğraf</th><th scope="col">Ad soyad</th><th scope="col">Yönetici</th><th scope="col">Yetki</th><th scope="col">Profili sil</th></tr></thead>
                <tbody>${users.map(user => `
                    <tr>
                        <td data-label="Fotoğraf"><div class="post__author-avatar"><img src="${security.escapeHtml(user.avatar)}" alt="${security.escapeHtml(user.name)}"></div></td>
                        <td data-label="Ad soyad">${security.escapeHtml(user.name)}</td>
                        <td data-label="Yönetici">${user.isAdmin ? 'Evet' : 'Hayır'}</td>
                        <td data-label="Yetki"><button type="button" class="btn sm toggle-admin" data-id="${user.id}" data-admin="${user.isAdmin}" ${user.isCurrent ? 'disabled' : ''}>${user.isCurrent ? 'Mevcut yönetici' : user.isAdmin ? 'Yetkiyi kaldır' : 'Yönetici yap'}</button></td>
                        <td data-label="Profili sil"><button type="button" class="btn sm danger delete-author" data-id="${user.id}" ${user.isCurrent ? 'disabled' : ''}>Sil</button></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        `);
        container.querySelectorAll('.toggle-admin:not([disabled])').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const nextValue = button.dataset.admin !== 'true';
                const { data: updated, error: updateError } = await client.from('authors')
                    .update({ is_admin: nextValue }).eq('id', id).select('id');
                if (updateError || !updated?.length) {
                    showMessage('Profil yetkisi güncellenemedi.');
                    button.disabled = false;
                    return;
                }
                showMessage(nextValue ? 'Kullanıcıya yönetici yetkisi verildi.' : 'Yönetici yetkisi kaldırıldı.', 'success');
                await refresh();
            });
        });
        container.querySelectorAll('.delete-author:not([disabled])').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Bu profil silinsin mi? Kimlik doğrulama hesabı korunacaktır.')) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const { data: deleted, error: deleteError } = await client.from('authors')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Profil silinemedi.');
                    button.disabled = false;
                    return;
                }
                showMessage('Profil silindi.', 'success');
                await refresh();
            });
        });
    };

    const renderAddCategory = (container, refresh) => {
        security.renderUi(container, `
            <form id="add-category-form">
                <input type="text" name="title" maxlength="100" placeholder="Kategori adı" required>
                <textarea rows="4" name="description" maxlength="1000" placeholder="Kategori açıklaması"></textarea>
                <button type="submit" class="btn">Kategori ekle</button>
            </form>
        `);
        container.querySelector('#add-category-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const formData = new FormData(event.currentTarget);
            const title = security.validateText(formData.get('title'), { min: 1, max: 100 });
            const description = security.validateText(formData.get('description') || '', { max: 1000 });
            if (!title || description === null) {
                showMessage('Kategori adı zorunludur ve en fazla 100 karakter olabilir.');
                return;
            }
            const { error } = await client.from('categories').insert({ title, description });
            if (error) {
                showMessage('Kategori eklenemedi.');
                return;
            }
            showMessage('Kategori eklendi.', 'success');
            event.currentTarget.reset();
            await refresh();
        });
    };

    const renderManageCategories = async (container, refresh) => {
        const { data, error } = await client.from('categories').select('id,title').order('title').limit(500);
        if (error || !Array.isArray(data)) {
            showMessage('Kategoriler yüklenemedi.');
            return;
        }
        const categories = data.map(category => ({
            id: safeId(category.id),
            title: security.validateText(category.title, { min: 1, max: 100 })
        })).filter(category => category.id && category.title);
        security.renderUi(container, `
            <div class="dashboard__table-scroll">
            <table class="dashboard__table dashboard__table--categories">
                <thead><tr><th scope="col">Kategori adı</th><th scope="col">Kaydet</th><th scope="col">Sil</th></tr></thead>
                <tbody>${categories.map(category => `
                    <tr data-id="${category.id}">
                        <td data-label="Kategori adı"><input class="category-title" maxlength="100" value="${security.escapeHtml(categoryTitle(category.title))}" aria-label="Kategori adı"></td>
                        <td data-label="Kaydet"><button type="button" class="btn sm save-category" data-id="${category.id}">Kaydet</button></td>
                        <td data-label="Sil"><button type="button" class="btn sm danger delete-category" data-id="${category.id}">Sil</button></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        `);
        container.querySelectorAll('.save-category').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                const input = button.closest('tr')?.querySelector('.category-title');
                const title = security.validateText(input?.value, { min: 1, max: 100 });
                if (!id || !title) {
                    showMessage('Kategori adı geçersiz.');
                    return;
                }
                const { data: updated, error: updateError } = await client.from('categories')
                    .update({ title }).eq('id', id).select('id');
                if (updateError || !updated?.length) {
                    showMessage('Kategori güncellenemedi.');
                    return;
                }
                showMessage('Kategori güncellendi.', 'success');
                await refresh();
            });
        });
        container.querySelectorAll('.delete-category').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Bu kategori silinsin mi? Kategorideki yazılar kategorisiz kalacaktır.')) {
                    return;
                }
                const { data: deleted, error: deleteError } = await client.from('categories')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Kategori silinemedi.');
                    return;
                }
                await refresh();
            });
        });
    };

    setupSignin();
    setupSignup();
    setupEditor();
    setupAddPost();
    renderDashboard();
}());
