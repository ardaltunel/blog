import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const htmlFiles = (await readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isFile() && extname(entry.name) === '.html')
    .map(entry => join(root, entry.name));
const failures = [];

for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
        const reference = match[1];
        if (/^(?:https?:|mailto:|tel:|#)/i.test(reference)) {
            continue;
        }
        const cleanReference = reference.split(/[?#]/, 1)[0];
        if (!cleanReference) {
            continue;
        }
        const target = resolve(dirname(file), cleanReference);
        if (!target.startsWith(root)) {
            failures.push(`${file}: path leaves repository: ${reference}`);
            continue;
        }
        try {
            await access(target);
        } catch {
            failures.push(`${file}: missing local asset: ${reference}`);
        }
    }
}

const cssFiles = [
    join(root, 'assets', 'css', 'style.css'),
    join(root, 'assets', 'vendor', 'montserrat', 'montserrat.css')
];
for (const file of cssFiles) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
        const reference = match[1];
        if (/^(?:data:|https?:)/i.test(reference)) {
            continue;
        }
        const target = resolve(dirname(file), reference);
        try {
            await access(target);
        } catch {
            failures.push(`${file}: missing CSS asset: ${reference}`);
        }
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Local link check passed for ${htmlFiles.length} HTML pages.`);
}
