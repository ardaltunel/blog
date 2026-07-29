(function initializeContentEnhancements(global) {
    'use strict';

    const security = global.SecurityUtils;

    const slugify = value => String(value || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);

    const createVideoEmbed = (video, title) => {
        const figure = document.createElement('figure');
        figure.className = 'youtube-embed';

        const frame = document.createElement('div');
        frame.className = 'youtube-embed__frame';
        const iframe = document.createElement('iframe');
        iframe.src = video.embedUrl;
        iframe.title = title || 'YouTube video oynatıcı';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        frame.append(iframe);

        const caption = document.createElement('figcaption');
        const captionText = document.createElement('span');
        captionText.textContent = 'Video içeriği';
        const watchLink = document.createElement('a');
        watchLink.href = video.watchUrl;
        watchLink.target = '_blank';
        watchLink.rel = 'noopener noreferrer nofollow';
        watchLink.textContent = 'YouTube’da aç';
        caption.append(captionText, watchLink);

        figure.append(frame, caption);
        return figure;
    };

    const containsOnlyVideoLabel = (container, anchor) => {
        if (!container || container.tagName !== 'P') {
            return false;
        }
        const clone = container.cloneNode(true);
        const matchingLink = Array.from(container.querySelectorAll('a')).indexOf(anchor);
        const clonedLink = clone.querySelectorAll('a')[matchingLink];
        clonedLink?.remove();
        const remainingText = clone.textContent
            .replace(/[\s:：–—-]+/g, '')
            .toLocaleLowerCase('tr-TR');
        return ['', 'video', 'youtube', 'izle'].includes(remainingText);
    };

    const enhanceYouTubeLinks = root => {
        const links = Array.from(root.querySelectorAll('a[href]'));
        Array.from(root.querySelectorAll('a:not([href])')).forEach(anchor => links.push(anchor));
        links.forEach(anchor => {
            if (!anchor.isConnected || anchor.closest('.youtube-embed')) {
                return;
            }
            const video = security?.parseYouTubeUrl(anchor.getAttribute('href') || anchor.textContent.trim());
            if (!video) {
                return;
            }

            const embed = createVideoEmbed(video, anchor.textContent.trim());
            const sourceFigure = anchor.closest('figure.content-video-source');
            const paragraph = anchor.closest('p');
            if (sourceFigure) {
                sourceFigure.replaceWith(embed);
            } else if (containsOnlyVideoLabel(paragraph, anchor)) {
                paragraph.replaceWith(embed);
            } else {
                anchor.classList.add('youtube-source-link');
                (paragraph || anchor).after(embed);
            }
        });
    };

    const promoteLegacyHeadings = root => {
        Array.from(root.querySelectorAll('p')).forEach(paragraph => {
            const meaningfulChildren = Array.from(paragraph.childNodes)
                .filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent.trim());
            if (meaningfulChildren.length !== 1 || meaningfulChildren[0].nodeName !== 'STRONG') {
                return;
            }
            const text = paragraph.textContent.trim();
            if (!/^\d{1,3}[.)]\s+\S/.test(text)) {
                return;
            }
            const heading = document.createElement('h2');
            heading.textContent = text;
            paragraph.replaceWith(heading);
        });
    };

    const addTableOfContents = root => {
        const headings = Array.from(root.querySelectorAll('h2, h3'))
            .filter(heading => heading.textContent.trim().length > 1);
        if (headings.length < 3) {
            return;
        }

        const usedIds = new Set();
        headings.forEach((heading, index) => {
            const base = slugify(heading.textContent) || `bolum-${index + 1}`;
            let id = base;
            let suffix = 2;
            while (usedIds.has(id)) {
                id = `${base}-${suffix}`;
                suffix += 1;
            }
            heading.id = id;
            usedIds.add(id);
        });

        const details = document.createElement('details');
        details.className = 'article-toc';
        const summary = document.createElement('summary');
        const summaryIcon = document.createElement('span');
        summaryIcon.className = 'article-toc__icon';
        summaryIcon.setAttribute('aria-hidden', 'true');

        const summaryCopy = document.createElement('span');
        summaryCopy.className = 'article-toc__summary-copy';
        const summaryTitle = document.createElement('strong');
        summaryTitle.textContent = 'İçindekiler';
        const summaryMeta = document.createElement('span');
        summaryMeta.textContent = `${headings.length} bölüm · Okumak istediğin yere geç`;
        summaryCopy.append(summaryTitle, summaryMeta);

        const summaryControl = document.createElement('span');
        summaryControl.className = 'article-toc__control';
        summaryControl.setAttribute('aria-hidden', 'true');
        const toggleText = document.createElement('span');
        toggleText.className = 'article-toc__toggle-text';
        const chevron = document.createElement('span');
        chevron.className = 'article-toc__chevron';
        summaryControl.append(toggleText, chevron);
        summary.append(summaryIcon, summaryCopy, summaryControl);

        const panel = document.createElement('div');
        panel.className = 'article-toc__panel';
        const list = document.createElement('ol');
        list.className = 'article-toc__list';

        headings.forEach((heading, index) => {
            const item = document.createElement('li');
            if (heading.tagName === 'H3') {
                item.className = 'article-toc__subitem';
            }
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            const number = document.createElement('span');
            number.className = 'article-toc__number';
            number.textContent = String(index + 1).padStart(2, '0');
            const label = document.createElement('span');
            label.className = 'article-toc__label';
            label.textContent = heading.textContent.trim().replace(/^\d{1,3}[.)]\s*/, '');
            link.append(number, label);
            item.append(link);
            list.append(item);
        });

        panel.append(list);
        details.append(summary, panel);
        root.before(details);
    };

    const enhance = root => {
        if (!root || root.dataset.enhanced === 'true') {
            return;
        }
        root.dataset.enhanced = 'true';
        promoteLegacyHeadings(root);
        enhanceYouTubeLinks(root);
        addTableOfContents(root);
    };

    global.ContentEnhancements = Object.freeze({ enhance });
}(window));
