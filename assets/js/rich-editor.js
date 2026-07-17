(function initializeRichEditor(global) {
    'use strict';

    const ICON_BASE = './assets/vendor/lucide/icons/';
    const commands = Object.freeze([
        ['undo', 'undo-2', 'Undo'],
        ['redo', 'redo-2', 'Redo'],
        ['bold', 'bold', 'Bold'],
        ['italic', 'italic', 'Italic'],
        ['formatBlock', 'heading-2', 'Heading 2', 'h2'],
        ['formatBlock', 'quote', 'Block quote', 'blockquote'],
        ['insertUnorderedList', 'list', 'Bulleted list'],
        ['insertOrderedList', 'list-ordered', 'Numbered list']
    ]);

    const icon = (name, label) => {
        const image = document.createElement('img');
        image.src = `${ICON_BASE}${name}.svg`;
        image.alt = '';
        image.width = 18;
        image.height = 18;
        image.setAttribute('aria-hidden', 'true');
        image.dataset.label = label;
        return image;
    };

    const serializeChildren = (element) => {
        const serializer = new XMLSerializer();
        return Array.from(element.childNodes, node => serializer.serializeToString(node)).join('');
    };

    const create = (textarea) => {
        if (!textarea || !global.SecurityUtils) {
            throw new Error('Editor could not be initialized.');
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'ck ck-reset ck-editor ck-rounded-corners safe-editor';
        const toolbar = document.createElement('div');
        toolbar.className = 'ck ck-toolbar safe-editor__toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Text formatting');
        const editable = document.createElement('div');
        editable.className = 'ck ck-content ck-editor__editable safe-editor__editable';
        editable.contentEditable = 'true';
        editable.setAttribute('role', 'textbox');
        editable.setAttribute('aria-multiline', 'true');
        editable.setAttribute('aria-label', textarea.placeholder || 'Post body');

        const runCommand = (command, value) => {
            editable.focus();
            document.execCommand(command, false, value || null);
        };

        commands.forEach(([command, iconName, label, value]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'safe-editor__button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.append(icon(iconName, label));
            button.addEventListener('click', () => runCommand(command, value));
            toolbar.append(button);
        });

        const linkButton = document.createElement('button');
        linkButton.type = 'button';
        linkButton.className = 'safe-editor__button';
        linkButton.title = 'Link';
        linkButton.setAttribute('aria-label', 'Link');
        linkButton.append(icon('link', 'Link'));
        linkButton.addEventListener('click', () => {
            const rawUrl = prompt('Enter an HTTPS or site-relative URL:');
            if (rawUrl === null) {
                return;
            }
            const href = global.SecurityUtils.safeContentUrl(rawUrl);
            if (href) {
                runCommand('createLink', href);
            }
        });
        toolbar.append(linkButton);

        editable.addEventListener('paste', event => {
            event.preventDefault();
            const text = event.clipboardData?.getData('text/plain') || '';
            document.execCommand('insertText', false, text.slice(0, 200000));
        });
        editable.addEventListener('drop', event => event.preventDefault());

        wrapper.append(toolbar, editable);
        textarea.hidden = true;
        textarea.insertAdjacentElement('afterend', wrapper);

        const setData = (html = '') => {
            editable.replaceChildren(global.SecurityUtils.sanitizeBlogFragment(html));
        };
        const getData = () => global.SecurityUtils.sanitizeBlogHtml(serializeChildren(editable));
        const destroy = async () => {
            wrapper.remove();
            textarea.hidden = false;
        };

        setData(textarea.value);
        return Object.freeze({ destroy, getData, setData });
    };

    global.SafeRichEditor = Object.freeze({ create });
}(window));
