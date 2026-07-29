(function initializeRichEditor(global) {
    'use strict';

    const ICON_BASE = './assets/vendor/lucide/icons/';
    const tools = Object.freeze([
        { command: 'undo', icon: 'undo-2', label: 'Geri al', group: 'history' },
        { command: 'redo', icon: 'redo-2', label: 'Yinele', group: 'history' },
        { command: 'bold', icon: 'bold', label: 'Kalın', group: 'style', stateful: true },
        { command: 'italic', icon: 'italic', label: 'İtalik', group: 'style', stateful: true },
        { command: 'formatBlock', icon: 'heading-2', label: 'Ana başlık', value: 'h2', group: 'structure' },
        { command: 'formatBlock', icon: 'heading-3', label: 'Alt başlık', value: 'h3', group: 'structure' },
        { command: 'formatBlock', icon: 'quote', label: 'Alıntı', value: 'blockquote', group: 'structure' },
        { command: 'insertUnorderedList', icon: 'list', label: 'Madde işaretli liste', group: 'list', stateful: true },
        { command: 'insertOrderedList', icon: 'list-ordered', label: 'Numaralı liste', group: 'list', stateful: true },
        { command: 'insertHorizontalRule', icon: 'minus', label: 'Ayırıcı çizgi', group: 'insert' },
        { command: 'removeFormat', icon: 'remove-formatting', label: 'Biçimlendirmeyi temizle', group: 'insert' }
    ]);

    const icon = name => {
        const image = document.createElement('img');
        image.src = `${ICON_BASE}${name}.svg`;
        image.alt = '';
        image.width = 18;
        image.height = 18;
        image.setAttribute('aria-hidden', 'true');
        return image;
    };

    const serializeChildren = element => {
        const serializer = new XMLSerializer();
        return Array.from(element.childNodes, node => serializer.serializeToString(node)).join('');
    };

    const create = textarea => {
        if (!textarea || !global.SecurityUtils) {
            throw new Error('Düzenleyici başlatılamadı.');
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'ck ck-reset ck-editor ck-rounded-corners safe-editor';
        const toolbar = document.createElement('div');
        toolbar.className = 'ck ck-toolbar safe-editor__toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'İçerik biçimlendirme araçları');
        const editable = document.createElement('div');
        editable.className = 'ck ck-content ck-editor__editable safe-editor__editable';
        editable.contentEditable = 'true';
        editable.setAttribute('role', 'textbox');
        editable.setAttribute('aria-multiline', 'true');
        editable.setAttribute('aria-label', textarea.placeholder || 'Yazı içeriği');
        editable.dataset.placeholder = 'Yazınızı buraya yazın…';
        const footer = document.createElement('div');
        footer.className = 'safe-editor__footer';
        const hint = document.createElement('span');
        hint.className = 'safe-editor__hint';
        hint.textContent = 'İpucu: Video düğmesini kullanın veya YouTube bağlantısını tek başına yapıştırın.';
        const counter = document.createElement('output');
        counter.className = 'safe-editor__counter';
        counter.setAttribute('aria-label', 'İçerik uzunluğu');
        footer.append(hint, counter);

        const selectedRange = () => {
            const selection = global.getSelection?.();
            if (!selection?.rangeCount || !editable.contains(selection.anchorNode)) {
                return null;
            }
            return selection.getRangeAt(0).cloneRange();
        };

        const restoreRange = range => {
            editable.focus();
            if (!range) {
                return;
            }
            const selection = global.getSelection?.();
            selection?.removeAllRanges();
            selection?.addRange(range);
        };

        const updateCounter = () => {
            const text = editable.textContent.replace(/\s+/g, ' ').trim();
            const words = text ? text.split(' ').length : 0;
            const characters = text.length;
            counter.textContent = `${words.toLocaleString('tr-TR')} kelime · ${characters.toLocaleString('tr-TR')} karakter`;
        };

        const notifyChange = () => {
            updateCounter();
            editable.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const runCommand = (command, value) => {
            editable.focus();
            document.execCommand(command, false, value || null);
            updateCounter();
        };

        const insertInlineNode = (node, range) => {
            restoreRange(range);
            const selection = global.getSelection?.();
            if (!selection?.rangeCount || !editable.contains(selection.anchorNode)) {
                editable.append(node);
            } else {
                const activeRange = selection.getRangeAt(0);
                activeRange.deleteContents();
                activeRange.insertNode(node);
                activeRange.setStartAfter(node);
                activeRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(activeRange);
            }
            notifyChange();
        };

        const insertBlockNode = (node, range) => {
            const origin = range?.startContainer?.nodeType === Node.ELEMENT_NODE
                ? range.startContainer
                : range?.startContainer?.parentElement;
            const block = origin?.closest?.('p, h2, h3, blockquote, ul, ol, figure, div');
            const paragraph = document.createElement('p');
            paragraph.append(document.createElement('br'));
            if (block && block !== editable && editable.contains(block)) {
                block.after(node, paragraph);
            } else {
                editable.append(node, paragraph);
            }
            const nextRange = document.createRange();
            nextRange.selectNodeContents(paragraph);
            nextRange.collapse(true);
            restoreRange(nextRange);
            notifyChange();
        };

        const createButton = (iconName, label) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'safe-editor__button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.append(icon(iconName));
            return button;
        };

        let previousGroup = '';
        const statefulButtons = [];
        tools.forEach(tool => {
            if (previousGroup && previousGroup !== tool.group) {
                const separator = document.createElement('span');
                separator.className = 'safe-editor__separator';
                separator.setAttribute('role', 'separator');
                toolbar.append(separator);
            }
            previousGroup = tool.group;
            const button = createButton(tool.icon, tool.label);
            button.addEventListener('click', () => runCommand(tool.command, tool.value));
            if (tool.stateful) {
                button.dataset.command = tool.command;
                button.setAttribute('aria-pressed', 'false');
                statefulButtons.push(button);
            }
            toolbar.append(button);
        });

        const linkButton = createButton('link', 'Bağlantı ekle');
        linkButton.addEventListener('click', () => {
            const range = selectedRange();
            const rawUrl = prompt('HTTPS bağlantısını girin:');
            if (rawUrl === null) {
                return;
            }
            const href = global.SecurityUtils.safeContentUrl(rawUrl);
            if (!href) {
                return;
            }
            restoreRange(range);
            if (range && !range.collapsed) {
                runCommand('createLink', href);
                return;
            }
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.textContent = href;
            insertInlineNode(anchor, range);
        });
        toolbar.append(linkButton);

        const insertVideoSource = (video, range) => {
            const figure = document.createElement('figure');
            figure.className = 'content-video-source';
            const anchor = document.createElement('a');
            anchor.href = video.watchUrl;
            anchor.textContent = `YouTube videosu · ${video.watchUrl}`;
            const caption = document.createElement('figcaption');
            caption.textContent = 'Yayınlandığında duyarlı video oynatıcı olarak görünecek.';
            figure.append(anchor, caption);
            insertBlockNode(figure, range);
        };

        const videoButton = createButton('video', 'YouTube videosu ekle');
        videoButton.classList.add('safe-editor__button--accent');
        videoButton.addEventListener('click', () => {
            const range = selectedRange();
            const rawUrl = prompt('YouTube video bağlantısını girin:');
            if (rawUrl === null) {
                return;
            }
            const video = global.SecurityUtils.parseYouTubeUrl(rawUrl);
            if (video) {
                insertVideoSource(video, range);
            } else {
                global.alert?.('Geçerli bir YouTube video bağlantısı girin.');
            }
        });
        toolbar.append(videoButton);

        const updateToolbarState = () => {
            if (!editable.contains(global.getSelection?.()?.anchorNode)) {
                return;
            }
            statefulButtons.forEach(button => {
                let active = false;
                try {
                    active = document.queryCommandState(button.dataset.command);
                } catch {
                    active = false;
                }
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
        };

        editable.addEventListener('input', updateCounter);
        editable.addEventListener('keyup', updateToolbarState);
        editable.addEventListener('mouseup', updateToolbarState);
        editable.addEventListener('paste', event => {
            const text = event.clipboardData?.getData('text/plain') || '';
            const video = global.SecurityUtils.parseYouTubeUrl(text.trim());
            event.preventDefault();
            if (video) {
                insertVideoSource(video, selectedRange());
                return;
            }
            document.execCommand('insertText', false, text.slice(0, 200000));
            updateCounter();
        });
        editable.addEventListener('drop', event => event.preventDefault());
        document.addEventListener('selectionchange', updateToolbarState);

        wrapper.append(toolbar, editable, footer);
        textarea.hidden = true;
        textarea.insertAdjacentElement('afterend', wrapper);

        const setData = (html = '') => {
            editable.replaceChildren(global.SecurityUtils.sanitizeBlogFragment(html));
            updateCounter();
        };
        const getData = () => global.SecurityUtils.sanitizeBlogHtml(serializeChildren(editable));
        const destroy = async () => {
            document.removeEventListener('selectionchange', updateToolbarState);
            wrapper.remove();
            textarea.hidden = false;
        };

        setData(textarea.value);
        return Object.freeze({ destroy, getData, setData });
    };

    global.SafeRichEditor = Object.freeze({ create });
}(window));
