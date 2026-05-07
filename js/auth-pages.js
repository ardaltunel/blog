const messageBox = document.querySelector('#auth-message');

const showMessage = (message, type = 'error') => {
    if (!messageBox) {
        return;
    }

    messageBox.hidden = false;
    messageBox.className = `alert__message ${type}`;
    messageBox.textContent = message;
};

const clearMessage = () => {
    if (!messageBox) {
        return;
    }

    messageBox.hidden = true;
    messageBox.textContent = '';
};

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const imageUrl = (fileName = '') => {
    const value = String(fileName || '1663704007ardaltunel-pp.png');

    if (/^(https?:|data:|blob:|\.\/|\.\.\/|\/)/.test(value)) {
        return value;
    }

    if (value.startsWith('images/')) {
        return `./${value}`;
    }

    return `./images/${value}`;
};

const requireSupabase = () => {
    if (!authClient) {
        showMessage('Supabase URL ve anon key js/supabase-config.js dosyasına eklenmeli.');
        return false;
    }

    return true;
};

const setupSignin = () => {
    const form = document.querySelector('#signin-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!requireSupabase()) {
            return;
        }

        const formData = new FormData(form);
        const { error } = await authClient.auth.signInWithPassword({
            email: formData.get('email'),
            password: formData.get('password')
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        window.location.href = './admin.html';
    });
};

const setupSignup = () => {
    const form = document.querySelector('#signup-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!requireSupabase()) {
            return;
        }

        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        const avatarFile = formData.get('avatar');

        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';

        try {
            const { data, error } = await authClient.auth.signUp({
                email: formData.get('email'),
                password: formData.get('password'),
                options: {
                    data: {
                        firstname: formData.get('firstname'),
                        lastname: formData.get('lastname')
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (avatarFile && avatarFile.name && data.user) {
                const { data: sessionData } = await authClient.auth.getSession();

                if (sessionData.session) {
                    const avatar = await uploadAvatar(avatarFile);
                    const { error: profileError } = await authClient
                        .from('authors')
                        .update({ avatar })
                        .eq('user_id', data.user.id);

                    if (profileError) {
                        throw profileError;
                    }
                }
            }

            showMessage('Account created. Please check your email if confirmation is enabled, then sign in.', 'success');
            form.reset();
        } catch (error) {
            showMessage(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Signup';
        }
    });
};

const loadCategoriesIntoSelect = async () => {
    const select = document.querySelector('#category-select');

    if (!select || !authClient) {
        return;
    }

    const { data, error } = await authClient.from('categories').select('id,title').order('title');

    if (error) {
        showMessage(error.message);
        return;
    }

    select.innerHTML = (data || [])
        .map(category => `<option value="${category.id}">${escapeHtml(category.title)}</option>`)
        .join('');
};

const uploadThumbnail = async (file) => {
    const extension = file.name.split('.').pop();
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bucket = authConfig.storageBucket || 'blog-images';

    const { error } = await authClient.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = authClient.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return data.publicUrl;
};

const uploadAvatar = async (file) => {
    const extension = file.name.split('.').pop();
    const fileName = `avatars/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bucket = authConfig.storageBucket || 'blog-images';

    const { error } = await authClient.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = authClient.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return data.publicUrl;
};

let activeEditor = null;
let editPostEditor = null;
let editorScriptPromise = null;

const loadEditorScript = () => {
    const script = document.createElement('script');

    if (window.ClassicEditor) {
        return Promise.resolve();
    }

    if (!editorScriptPromise) {
        editorScriptPromise = new Promise((resolve, reject) => {
            script.src = 'https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Editor could not be loaded.'));
            document.head.appendChild(script);
        });
    }

    return editorScriptPromise;
};

const createClassicEditor = async (editorElement) => {
    await loadEditorScript();

    return ClassicEditor.create(editorElement, {
        toolbar: [
            'undo', 'redo', '|',
            'heading', '|',
            'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|',
            'blockQuote'
        ]
    });
};

const setupEditor = () => {
    const editorElement = document.querySelector('#editor');

    if (!editorElement) {
        return;
    }

    createClassicEditor(editorElement)
        .then(editor => {
            activeEditor = editor;
        })
        .catch(error => {
            console.error(error);
            showMessage(error.message);
        });
};

const setupAddPost = async () => {
    const form = document.querySelector('#add-post-form');

    if (!form) {
        return;
    }

    if (!requireSupabase()) {
        return;
    }

    const { user, profile } = await getProfile();

    if (!user || !profile) {
        window.location.href = './signin.html';
        return;
    }

    await loadCategoriesIntoSelect();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const file = formData.get('thumbnail');
        const submitButton = form.querySelector('button[type="submit"]');
        const body = activeEditor ? activeEditor.getData().trim() : String(formData.get('body') || '').trim();

        if (!body) {
            showMessage('Please enter post body.');
            return;
        }

        if (!file || !file.name) {
            showMessage('Please choose a thumbnail.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        try {
            const thumbnail = await uploadThumbnail(file);
            const { error } = await authClient.from('posts').insert({
                title: formData.get('title'),
                body,
                thumbnail,
                category_id: Number(formData.get('category')),
                author_id: profile.id,
                is_featured: false,
                is_verified: false
            });

            if (error) {
                throw error;
            }

            showMessage('Post sent for admin review.', 'success');
            form.reset();
            activeEditor?.setData('');
        } catch (error) {
            showMessage(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send for Review';
        }
    });
};

const renderDashboard = async () => {
    const container = document.querySelector('#dashboard-content');
    const title = document.querySelector('#dashboard-title');

    if (!container) {
        return;
    }

    if (!requireSupabase()) {
        return;
    }

    const { user, profile } = await getProfile();

    if (!user || !profile) {
        window.location.href = './signin.html';
        return;
    }

    document.querySelectorAll('[data-admin-only]').forEach(item => {
        item.style.display = profile.is_admin ? '' : 'none';
    });

    const view = new URLSearchParams(window.location.search).get('view') || 'my-posts';
    const safeView = profile.is_admin ? view : 'my-posts';
    document.querySelectorAll('[data-view-link]').forEach(link => {
        link.classList.toggle('active', link.dataset.viewLink === safeView);
    });

    const refresh = () => renderDashboard();
    const adminOnly = () => {
        if (!profile.is_admin) {
            title.textContent = 'My Posts';
            container.innerHTML = '<div class="alert__message error">Only admins can view this page.</div>';
            return false;
        }
        return true;
    };

    if (safeView === 'add-user') {
        if (!adminOnly()) return;
        title.textContent = 'Add User';
        renderAddUser(container);
        return;
    }

    if (safeView === 'manage-users') {
        if (!adminOnly()) return;
        title.textContent = 'Manage Users';
        await renderManageUsers(container, refresh);
        return;
    }

    if (safeView === 'add-category') {
        if (!adminOnly()) return;
        title.textContent = 'Add Category';
        renderAddCategory(container, refresh);
        return;
    }

    if (safeView === 'manage-categories') {
        if (!adminOnly()) return;
        title.textContent = 'Manage Categories';
        await renderManageCategories(container, refresh);
        return;
    }

    title.textContent = safeView === 'all-posts' ? 'All Posts' : 'My Posts';
    await renderPostsTable(container, profile, safeView, refresh);
};

const renderPostsTable = async (container, profile, view, refresh) => {
    const select = profile.is_admin
        ? 'id,title,body,thumbnail,date_time,is_verified,category_id,author_id,authors(firstname,lastname),categories(title)'
        : 'id,title,body,thumbnail,date_time,is_verified,category_id,categories(title)';
    const query = authClient.from('posts').select(select).order('date_time', { ascending: false });
    const { data, error } = profile.is_admin && view === 'all-posts'
        ? await query
        : await query.eq('author_id', profile.id);

    if (error) {
        showMessage(error.message);
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    ${profile.is_admin && view === 'all-posts' ? '<th>Author</th>' : ''}
                    <th>Edit</th>
                    ${profile.is_admin ? '<th>Publish</th><th>Delete</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${(data || []).map(post => `
                    <tr>
                        <td>${escapeHtml(post.title)}</td>
                        <td>${escapeHtml(post.categories?.title || '')}</td>
                        <td>${post.is_verified ? 'Published' : 'Waiting'}</td>
                        ${profile.is_admin && view === 'all-posts' ? `
                            <td>${escapeHtml(post.authors ? `${post.authors.firstname} ${post.authors.lastname}` : '')}</td>
                        ` : ''}
                        <td><button class="btn sm edit-post" data-id="${post.id}">Edit</button></td>
                        ${profile.is_admin ? `
                            <td>
                                <button class="btn sm toggle-post" data-id="${post.id}" data-verified="${post.is_verified}">
                                    ${post.is_verified ? 'Unpublish' : 'Publish'}
                                </button>
                            </td>
                            <td><button class="btn sm danger delete-post" data-id="${post.id}">Delete</button></td>
                        ` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div id="edit-post-panel"></div>
    `;

    document.querySelectorAll('.toggle-post').forEach(button => {
        button.addEventListener('click', async () => {
            clearMessage();
            button.disabled = true;
            const nextValue = button.dataset.verified !== 'true';
            const { error } = await authClient
                .from('posts')
                .update({ is_verified: nextValue })
                .eq('id', Number(button.dataset.id));

            if (error) {
                showMessage(error.message);
                button.disabled = false;
                return;
            }
            await refresh();
        });
    });

    document.querySelectorAll('.delete-post').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('Delete this post?')) return;
            clearMessage();
            button.disabled = true;
            const { error } = await authClient.from('posts').delete().eq('id', Number(button.dataset.id));
            if (error) {
                showMessage(error.message);
                button.disabled = false;
                return;
            }
            await refresh();
        });
    });

    document.querySelectorAll('.edit-post').forEach(button => {
        button.addEventListener('click', async () => {
            await renderEditPostPanel(Number(button.dataset.id), refresh);
        });
    });
};

const renderEditPostPanel = async (postId, refresh) => {
    const panel = document.querySelector('#edit-post-panel');

    if (editPostEditor) {
        await editPostEditor.destroy().catch(error => console.error(error));
        editPostEditor = null;
    }

    const [{ data: post, error: postError }, { data: categories, error: categoriesError }] = await Promise.all([
        authClient.from('posts').select('id,title,body,category_id,is_verified').eq('id', postId).single(),
        authClient.from('categories').select('id,title').order('title')
    ]);

    if (postError || categoriesError) {
        showMessage((postError || categoriesError).message);
        return;
    }

    panel.innerHTML = `
        <div class="form__section-container dashboard__editor">
            <h3>Edit Post</h3>
            <form id="edit-post-form">
                <input type="text" name="title" value="${escapeHtml(post.title)}" required>
                <select name="category">
                    ${(categories || []).map(category => `
                        <option value="${category.id}" ${Number(category.id) === Number(post.category_id) ? 'selected' : ''}>${escapeHtml(category.title)}</option>
                    `).join('')}
                </select>
                <textarea name="body" id="edit-editor" rows="10" required>${escapeHtml(post.body)}</textarea>
                <button type="submit" class="btn">Save</button>
            </form>
        </div>
    `;

    try {
        editPostEditor = await createClassicEditor(document.querySelector('#edit-editor'));
    } catch (error) {
        console.error(error);
        showMessage(error.message);
    }

    document.querySelector('#edit-post-form').addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const submitButton = event.currentTarget.querySelector('button[type="submit"]');
        const body = editPostEditor ? editPostEditor.getData().trim() : String(formData.get('body') || '').trim();

        if (!body) {
            showMessage('Please enter post body.');
            return;
        }

        clearMessage();
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        const { error } = await authClient.from('posts').update({
            title: formData.get('title'),
            body,
            category_id: Number(formData.get('category'))
        }).eq('id', postId);

        if (error) {
            showMessage(error.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Save';
            return;
        }

        showMessage('Post updated.', 'success');
        await refresh();
    });
};

const renderAddUser = (container) => {
    container.innerHTML = `
        <form id="admin-add-user-form">
            <input type="text" name="firstname" placeholder="Firstname" required>
            <input type="text" name="lastname" placeholder="Lastname" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Password" required>
            <div class="form__control inline">
                <input type="checkbox" name="is_admin" value="1" id="new_user_admin">
                <label for="new_user_admin">Admin</label>
            </div>
            <button type="submit" class="btn">Add User</button>
        </form>
    `;

    document.querySelector('#admin-add-user-form').addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const { data, error } = await authClient.auth.signUp({
            email: formData.get('email'),
            password: formData.get('password'),
            options: {
                data: {
                    firstname: formData.get('firstname'),
                    lastname: formData.get('lastname')
                }
            }
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        if (data.user && formData.get('is_admin')) {
            await authClient.from('authors').update({ is_admin: true }).eq('user_id', data.user.id);
        }

        showMessage('User created. If email confirmation is enabled, the user must confirm email before login.', 'success');
        event.currentTarget.reset();
    });
};

const renderManageUsers = async (container, refresh) => {
    const { data, error } = await authClient.from('authors').select('id,firstname,lastname,avatar,is_admin,user_id').order('id', { ascending: false });
    if (error) {
        showMessage(error.message);
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>Avatar</th><th>Name</th><th>Admin</th><th>Toggle Admin</th><th>Delete Profile</th></tr></thead>
            <tbody>
                ${(data || []).map(user => `
                    <tr>
                        <td><div class="post__author-avatar"><img src="${imageUrl(user.avatar)}" alt="${escapeHtml(`${user.firstname} ${user.lastname}`)}"></div></td>
                        <td>${escapeHtml(`${user.firstname} ${user.lastname}`)}</td>
                        <td>${user.is_admin ? 'Yes' : 'No'}</td>
                        <td><button class="btn sm toggle-admin" data-id="${user.id}" data-admin="${user.is_admin}">${user.is_admin ? 'Remove Admin' : 'Make Admin'}</button></td>
                        <td><button class="btn sm danger delete-author" data-id="${user.id}">Delete</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.querySelectorAll('.toggle-admin').forEach(button => {
        button.addEventListener('click', async () => {
            clearMessage();
            button.disabled = true;
            const nextValue = button.dataset.admin !== 'true';
            const { data: updatedUser, error: updateError } = await authClient
                .from('authors')
                .update({ is_admin: nextValue })
                .eq('id', Number(button.dataset.id))
                .select('id')
                .single();

            if (updateError) {
                showMessage(updateError.message);
                button.disabled = false;
                return;
            }

            if (!updatedUser) {
                showMessage('Profile could not be updated. Check Supabase admin policies.');
                button.disabled = false;
                return;
            }

            showMessage(nextValue ? 'User is now an admin.' : 'Admin access removed.', 'success');
            await refresh();
        });
    });

    document.querySelectorAll('.delete-author').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('Delete this profile? Auth user may still remain in Supabase Authentication.')) return;
            clearMessage();
            button.disabled = true;
            const { data: deletedUser, error: deleteError } = await authClient
                .from('authors')
                .delete()
                .eq('id', Number(button.dataset.id))
                .select('id')
                .single();

            if (deleteError) {
                showMessage(deleteError.message);
                button.disabled = false;
                return;
            }

            if (!deletedUser) {
                showMessage('Profile could not be deleted. Check Supabase admin policies.');
                button.disabled = false;
                return;
            }

            showMessage('Profile deleted.', 'success');
            await refresh();
        });
    });
};

const renderAddCategory = (container, refresh) => {
    container.innerHTML = `
        <form id="add-category-form">
            <input type="text" name="title" placeholder="Title" required>
            <textarea rows="4" name="description" placeholder="Description"></textarea>
            <button type="submit" class="btn">Add Category</button>
        </form>
    `;

    document.querySelector('#add-category-form').addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const { error } = await authClient.from('categories').insert({
            title: formData.get('title'),
            description: formData.get('description') || ''
        });
        if (error) {
            showMessage(error.message);
            return;
        }
        showMessage('Category added.', 'success');
        event.currentTarget.reset();
        await refresh();
    });
};

const renderManageCategories = async (container, refresh) => {
    const { data, error } = await authClient.from('categories').select('id,title,description').order('title');
    if (error) {
        showMessage(error.message);
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>Title</th><th>Edit</th><th>Delete</th></tr></thead>
            <tbody>
                ${(data || []).map(category => `
                    <tr>
                        <td><input class="category-title" data-id="${category.id}" value="${escapeHtml(category.title)}"></td>
                        <td><button class="btn sm save-category" data-id="${category.id}">Save</button></td>
                        <td><button class="btn sm danger delete-category" data-id="${category.id}">Delete</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.querySelectorAll('.save-category').forEach(button => {
        button.addEventListener('click', async () => {
            const input = document.querySelector(`.category-title[data-id="${button.dataset.id}"]`);
            const { error: updateError } = await authClient.from('categories').update({ title: input.value }).eq('id', Number(button.dataset.id));
            if (updateError) {
                showMessage(updateError.message);
                return;
            }
            showMessage('Category updated.', 'success');
            await refresh();
        });
    });

    document.querySelectorAll('.delete-category').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('Delete this category? Posts in this category will become uncategorized.')) return;
            const { error: deleteError } = await authClient.from('categories').delete().eq('id', Number(button.dataset.id));
            if (deleteError) {
                showMessage(deleteError.message);
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
