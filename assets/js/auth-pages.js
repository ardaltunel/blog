(function initializeAuthPages() {
    'use strict';

    const security = window.SecurityUtils;
    const client = window.authClient;
    const config = window.authConfig;
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
        security.renderUi(editPostPanel, '<p class="dashboard__modal-loading">Loading editor...</p>');
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
            showMessage('Service is temporarily unavailable.');
            return false;
        }
        return true;
    };
    const safeId = value => security.toSafeId(value);
    const readName = value => security.validateText(value, { min: 1, max: 80 });
    const readTitle = value => security.validateText(value, { min: 1, max: 160 });
    const setSubmitting = (button, disabled, label) => {
        if (button) {
            button.disabled = disabled;
            button.textContent = label;
        }
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
                showMessage('Enter a valid email and a password between 8 and 128 characters.');
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
            const avatarFile = formData.get('avatar');
            const hasAvatar = avatarFile && avatarFile.name;
            if (!firstname || !lastname || !email || !password) {
                showMessage('Check your name, email and password. Passwords must be 8 to 128 characters.');
                return;
            }
            if (hasAvatar && !security.validateImageFile(avatarFile, 2 * 1024 * 1024)) {
                showMessage('Profile image must be PNG, JPEG or WebP and no larger than 2 MB.');
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Creating...');
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
                    showMessage('Account could not be created. Check your details and try again.');
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
                    ? ' Confirm your email, then select the image again on the Profile page.'
                    : '';
                showMessage(`Account created. Check your email if confirmation is enabled.${suffix}`, 'success');
                form.reset();
            } catch {
                await cleanupUpload(uploadedPath);
                showMessage('Account setup could not be completed. Try again.');
            } finally {
                setSubmitting(button, false, 'Signup');
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
            showMessage('Categories could not be loaded.');
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
            option.textContent = title;
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
            showMessage('Editor could not be loaded.');
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
                showMessage('Title, category and post body are required.');
                return;
            }
            if (!security.validateImageFile(thumbnailFile, 5 * 1024 * 1024)) {
                showMessage('Thumbnail must be PNG, JPEG or WebP and no larger than 5 MB.');
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
            title.textContent = 'My Posts';
            security.renderUi(container, '<div class="alert__message error">Only admins can view this page.</div>');
            return false;
        };

        if (safeView === 'profile') {
            title.textContent = 'Profile';
            renderProfile(container, user, profile, refresh);
            return;
        }

        if (safeView === 'add-user') {
            if (adminOnly()) {
                title.textContent = 'Add User';
                renderAddUser(container);
            }
            return;
        }
        if (safeView === 'manage-users') {
            if (adminOnly()) {
                title.textContent = 'Manage Users';
                await renderManageUsers(container, profile, refresh);
            }
            return;
        }
        if (safeView === 'add-category') {
            if (adminOnly()) {
                title.textContent = 'Add Category';
                renderAddCategory(container, refresh);
            }
            return;
        }
        if (safeView === 'manage-categories') {
            if (adminOnly()) {
                title.textContent = 'Manage Categories';
                await renderManageCategories(container, refresh);
            }
            return;
        }
        title.textContent = safeView === 'all-posts' ? 'All Posts' : 'My Posts';
        await renderPostsTable(container, profile, safeView, refresh);
    };

    const renderProfile = (container, user, profile, refresh) => {
        security.renderUi(container, `
            <div class="form__section-container dashboard__profile-editor">
                <div class="dashboard__profile-avatar"><img src="${security.escapeHtml(profile.avatar)}" alt="${security.escapeHtml(profile.firstname)}"></div>
                <form id="profile-avatar-form">
                    <label for="profile-avatar">Profile image</label>
                    <input type="file" name="avatar" id="profile-avatar" accept="image/png,image/jpeg,image/webp" required>
                    <button type="submit" class="btn">Update Image</button>
                </form>
            </div>
        `);
        container.querySelector('#profile-avatar-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const form = event.currentTarget;
            const file = new FormData(form).get('avatar');
            if (!security.validateImageFile(file, 2 * 1024 * 1024)) {
                showMessage('Profile image must be PNG, JPEG or WebP and no larger than 2 MB.');
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Uploading...');
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
                showMessage('Profile image updated.', 'success');
                await refresh();
            } catch {
                await cleanupUpload(uploadedPath);
                showMessage('Profile image could not be updated. Try again.');
            } finally {
                setSubmitting(button, false, 'Update Image');
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
            showMessage('Posts could not be loaded.');
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
                categoryTitle: security.validateText(post.categories?.title || '', { max: 100 }) || '',
                authorName: security.validateText(
                    post.authors ? `${post.authors.firstname || ''} ${post.authors.lastname || ''}`.trim() : '',
                    { max: 161 }
                ) || ''
            };
        }).filter(Boolean);
        security.renderUi(container, `
            <div class="dashboard__table-scroll">
            <table class="dashboard__table dashboard__table--posts">
                <thead><tr>
                    <th scope="col">Title</th><th scope="col">Category</th>
                    ${profile.is_admin && view === 'all-posts' ? '<th scope="col">Author</th>' : ''}
                    <th scope="col">Edit</th>${profile.is_admin ? '<th scope="col">Publish</th><th scope="col">Delete</th>' : ''}
                </tr></thead>
                <tbody>${posts.map(post => `
                    <tr>
                        <td data-label="Title">${security.escapeHtml(post.title)}</td>
                        <td data-label="Category">${security.escapeHtml(post.categoryTitle)}</td>
                        ${profile.is_admin && view === 'all-posts' ? `<td data-label="Author">${security.escapeHtml(post.authorName)}</td>` : ''}
                        <td data-label="Edit"><button type="button" class="btn sm edit-post" data-id="${post.id}">Edit</button></td>
                        ${profile.is_admin ? `
                            <td data-label="Publish"><button type="button" class="btn sm toggle-post" data-id="${post.id}" data-verified="${post.is_verified === true}">${post.is_verified === true ? 'Unpublish' : 'Publish'}</button></td>
                            <td data-label="Delete"><button type="button" class="btn sm danger delete-post" data-id="${post.id}">Delete</button></td>
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
                    showMessage('Post status could not be updated.');
                    button.disabled = false;
                    return;
                }
                await refresh();
            });
        });
        container.querySelectorAll('.delete-post').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Delete this post?')) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const { data: deleted, error: deleteError } = await client.from('posts')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Post could not be deleted.');
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
            showEditPostMessage('Post editor could not be loaded.');
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
            showEditPostMessage('Post data is invalid.');
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
                        <option value="${category.id}" ${category.id === categoryId ? 'selected' : ''}>${security.escapeHtml(category.title)}</option>
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
            showEditPostMessage('Editor could not be loaded.');
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
                showEditPostMessage('Title, category and post body are required.');
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
                showEditPostMessage('Post could not be updated.');
                setSubmitting(button, false, 'Değişiklikleri kaydet');
                return;
            }
            showMessage('Post updated.', 'success');
            await refresh();
            await closeEditPostModal();
        });
    };

    const renderAddUser = container => {
        security.renderUi(container, `
            <form id="admin-add-user-form">
                <input type="text" name="firstname" maxlength="80" placeholder="Firstname" required>
                <input type="text" name="lastname" maxlength="80" placeholder="Lastname" required>
                <input type="email" name="email" maxlength="254" placeholder="Email" required>
                <input type="password" name="password" minlength="8" maxlength="128" placeholder="Password" required>
                <div class="form__control inline">
                    <input type="checkbox" name="is_admin" value="1" id="new_user_admin">
                    <label for="new_user_admin">Admin</label>
                </div>
                <button type="submit" class="btn">Add User</button>
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
                showMessage('Check the name, email and password fields.');
                return;
            }
            const button = event.currentTarget.querySelector('button[type="submit"]');
            setSubmitting(button, true, 'Adding...');
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
                    showMessage('User could not be created.');
                    return;
                }
                if (formData.get('is_admin')) {
                    const { data: updated, error: roleError } = await client.from('authors')
                        .update({ is_admin: true }).eq('user_id', data.user.id).select('id');
                    if (roleError || !updated?.length) {
                        showMessage('User was created, but admin access could not be assigned.');
                        return;
                    }
                }
                showMessage('User created. Email confirmation may still be required.', 'success');
                event.currentTarget.reset();
            } catch {
                showMessage('User could not be created.');
            } finally {
                setSubmitting(button, false, 'Add User');
            }
        });
    };

    const renderManageUsers = async (container, currentProfile, refresh) => {
        const { data, error } = await client.from('authors')
            .select('id,firstname,lastname,avatar,is_admin,user_id').order('id', { ascending: false }).limit(2000);
        if (error || !Array.isArray(data)) {
            showMessage('Profiles could not be loaded.');
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
                <thead><tr><th scope="col">Avatar</th><th scope="col">Name</th><th scope="col">Admin</th><th scope="col">Toggle Admin</th><th scope="col">Delete Profile</th></tr></thead>
                <tbody>${users.map(user => `
                    <tr>
                        <td data-label="Avatar"><div class="post__author-avatar"><img src="${security.escapeHtml(user.avatar)}" alt="${security.escapeHtml(user.name)}"></div></td>
                        <td data-label="Name">${security.escapeHtml(user.name)}</td>
                        <td data-label="Admin">${user.isAdmin ? 'Yes' : 'No'}</td>
                        <td data-label="Toggle Admin"><button type="button" class="btn sm toggle-admin" data-id="${user.id}" data-admin="${user.isAdmin}" ${user.isCurrent ? 'disabled' : ''}>${user.isCurrent ? 'Current Admin' : user.isAdmin ? 'Remove Admin' : 'Make Admin'}</button></td>
                        <td data-label="Delete Profile"><button type="button" class="btn sm danger delete-author" data-id="${user.id}" ${user.isCurrent ? 'disabled' : ''}>Delete</button></td>
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
                    showMessage('Profile access could not be updated.');
                    button.disabled = false;
                    return;
                }
                showMessage(nextValue ? 'User is now an admin.' : 'Admin access removed.', 'success');
                await refresh();
            });
        });
        container.querySelectorAll('.delete-author:not([disabled])').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Delete this profile? The Authentication account will remain.')) {
                    return;
                }
                clearMessage();
                button.disabled = true;
                const { data: deleted, error: deleteError } = await client.from('authors')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Profile could not be deleted.');
                    button.disabled = false;
                    return;
                }
                showMessage('Profile deleted.', 'success');
                await refresh();
            });
        });
    };

    const renderAddCategory = (container, refresh) => {
        security.renderUi(container, `
            <form id="add-category-form">
                <input type="text" name="title" maxlength="100" placeholder="Title" required>
                <textarea rows="4" name="description" maxlength="1000" placeholder="Description"></textarea>
                <button type="submit" class="btn">Add Category</button>
            </form>
        `);
        container.querySelector('#add-category-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();
            const formData = new FormData(event.currentTarget);
            const title = security.validateText(formData.get('title'), { min: 1, max: 100 });
            const description = security.validateText(formData.get('description') || '', { max: 1000 });
            if (!title || description === null) {
                showMessage('Category title is required and must be at most 100 characters.');
                return;
            }
            const { error } = await client.from('categories').insert({ title, description });
            if (error) {
                showMessage('Category could not be added.');
                return;
            }
            showMessage('Category added.', 'success');
            event.currentTarget.reset();
            await refresh();
        });
    };

    const renderManageCategories = async (container, refresh) => {
        const { data, error } = await client.from('categories').select('id,title').order('title').limit(500);
        if (error || !Array.isArray(data)) {
            showMessage('Categories could not be loaded.');
            return;
        }
        const categories = data.map(category => ({
            id: safeId(category.id),
            title: security.validateText(category.title, { min: 1, max: 100 })
        })).filter(category => category.id && category.title);
        security.renderUi(container, `
            <div class="dashboard__table-scroll">
            <table class="dashboard__table dashboard__table--categories">
                <thead><tr><th scope="col">Title</th><th scope="col">Edit</th><th scope="col">Delete</th></tr></thead>
                <tbody>${categories.map(category => `
                    <tr data-id="${category.id}">
                        <td data-label="Title"><input class="category-title" maxlength="100" value="${security.escapeHtml(category.title)}" aria-label="Category title"></td>
                        <td data-label="Edit"><button type="button" class="btn sm save-category" data-id="${category.id}">Save</button></td>
                        <td data-label="Delete"><button type="button" class="btn sm danger delete-category" data-id="${category.id}">Delete</button></td>
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
                    showMessage('Category title is invalid.');
                    return;
                }
                const { data: updated, error: updateError } = await client.from('categories')
                    .update({ title }).eq('id', id).select('id');
                if (updateError || !updated?.length) {
                    showMessage('Category could not be updated.');
                    return;
                }
                showMessage('Category updated.', 'success');
                await refresh();
            });
        });
        container.querySelectorAll('.delete-category').forEach(button => {
            button.addEventListener('click', async () => {
                const id = safeId(button.dataset.id);
                if (!id || !confirm('Delete this category? Posts will become uncategorized.')) {
                    return;
                }
                const { data: deleted, error: deleteError } = await client.from('categories')
                    .delete().eq('id', id).select('id');
                if (deleteError || !deleted?.length) {
                    showMessage('Category could not be deleted.');
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
