import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
const siteUrl = new URL(process.env.SITE_URL || 'https://ardaltunel.github.io/blog/');
if (!siteUrl.pathname.endsWith('/')) {
    siteUrl.pathname += '/';
}
const basePath = siteUrl.pathname;
const failures = [];

const walk = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(path));
        } else {
            files.push(path);
        }
    }
    return files;
};
const exists = async path => {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
};
const read = path => readFile(path, 'utf8');
const report = (condition, message) => {
    if (!condition) {
        failures.push(message);
    }
};
const urlToFile = value => {
    const parsed = new URL(value);
    if (parsed.origin !== siteUrl.origin || !parsed.pathname.startsWith(basePath)) {
        return null;
    }
    const route = decodeURIComponent(parsed.pathname.slice(basePath.length));
    if (!route) {
        return join(output, 'index.html');
    }
    return route.endsWith('/')
        ? join(output, route, 'index.html')
        : join(output, route);
};

report(await exists(output), 'dist: build output is missing');
if (!await exists(output)) {
    console.error(failures.join('\n'));
    process.exit(1);
}

const files = await walk(output);
const htmlFiles = files.filter(file => extname(file) === '.html');
const sitemapPath = join(output, 'sitemap.xml');
const robotsPath = join(output, 'robots.txt');
const feedPath = join(output, 'feed.xml');
report(await exists(sitemapPath), 'sitemap.xml is missing');
report(await exists(robotsPath), 'robots.txt is missing');
report(await exists(feedPath), 'feed.xml is missing');

const indexableFiles = [];
let articlePages = 0;
for (const file of htmlFiles) {
    const html = await read(file);
    const name = relative(output, file).replaceAll('\\', '/');
    const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] || '';
    const indexable = robots.split(',').map(value => value.trim()).includes('index');
    if (indexable) {
        indexableFiles.push(file);
        report(/<title>[^<]{3,}<\/title>/i.test(html), `${name}: missing title`);
        report(/<meta\s+name=["']description["']\s+content=["'][^"']{30,}["']/i.test(html), `${name}: missing useful meta description`);
        report(/<link\s+rel=["']canonical["']\s+href=["']https:\/\/[^"']+["']/i.test(html), `${name}: missing absolute canonical`);
        report(/<meta\s+property=["']og:title["']/i.test(html), `${name}: missing Open Graph title`);
        report(/<meta\s+property=["']og:url["']/i.test(html), `${name}: missing Open Graph URL`);
        report(/<meta\s+name=["']twitter:card["']/i.test(html), `${name}: missing Twitter card`);
        report(/<script\s+type=["']application\/ld\+json["']>[\s\S]+?<\/script>/i.test(html), `${name}: missing JSON-LD`);
        for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]+?)<\/script>/gi)) {
            try {
                JSON.parse(match[1]);
            } catch {
                failures.push(`${name}: invalid JSON-LD`);
            }
        }
    }
    if (/"@type":"BlogPosting"/.test(html)) {
        articlePages += 1;
        report(/<article\b/i.test(html), `${name}: article page has no semantic article element`);
        report(/class=["']article-content["'][^>]*>[\s\S]*?<\//i.test(html), `${name}: article content was not pre-rendered`);
        report(/<h1>[^<]+<\/h1>/i.test(html), `${name}: article page has no H1`);
    }
}

report(articlePages > 0, 'No pre-rendered BlogPosting pages were found');
report(indexableFiles.length > articlePages, 'No indexable home or category pages were found');

if (await exists(sitemapPath)) {
    const sitemap = await read(sitemapPath);
    report(/^<\?xml[^>]+encoding=["']UTF-8["']/i.test(sitemap), 'sitemap.xml must be UTF-8 XML');
    report(!/post\.html\?id=|\/yazi\//i.test(sitemap), 'sitemap.xml contains a legacy post URL');
    report(!/\/kategori\/(?:about-life|advertising|education|science-technology|software|uncategorized)\//i.test(sitemap),
        'sitemap.xml contains a non-localized built-in category URL');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
    report(locations.length === indexableFiles.length, 'sitemap.xml URL count does not match indexable page count');
    for (const location of locations) {
        const target = urlToFile(location);
        report(Boolean(target), `sitemap.xml contains an off-site URL: ${location}`);
        if (target) {
            report(await exists(target), `sitemap.xml target is missing: ${location}`);
        }
    }
}

if (await exists(robotsPath)) {
    const robots = await read(robotsPath);
    report(robots.includes(`Sitemap: ${new URL('sitemap.xml', siteUrl).href}`), 'robots.txt does not reference the sitemap');
    report(robots.includes(`Disallow: ${basePath}admin.html`), 'robots.txt does not disallow the admin page');
}
if (await exists(feedPath)) {
    const feed = await read(feedPath);
    report(/<feed\s+xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(feed), 'feed.xml is not an Atom feed');
    report(/<entry>[\s\S]+?<\/entry>/i.test(feed), 'feed.xml contains no entries');
}

for (const file of htmlFiles) {
    const html = await read(file);
    const name = relative(output, file).replaceAll('\\', '/');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
        const reference = match[1];
        if (/^(?:https?:|mailto:|tel:|#)/i.test(reference)) {
            continue;
        }
        const clean = reference.split(/[?#]/, 1)[0];
        if (!clean) {
            continue;
        }
        const target = clean.startsWith(basePath)
            ? resolve(output, clean.slice(basePath.length))
            : resolve(dirname(file), clean);
        const resolvedOutput = resolve(output);
        if (target !== resolvedOutput && !target.startsWith(`${resolvedOutput}${sep}`)) {
            failures.push(`${name}: path leaves build output: ${reference}`);
            continue;
        }
        report(await exists(target), `${name}: missing build asset: ${reference}`);
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`SEO verification passed for ${indexableFiles.length} indexable pages (${articlePages} articles).`);
}
