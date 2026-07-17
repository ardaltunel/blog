import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');
const vendor = join(root, 'assets', 'vendor');

const copy = async (source, destination) => {
    const target = join(vendor, destination);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(modules, source), target);
};

await Promise.all([
    copy('@supabase/supabase-js/dist/umd/supabase.js', 'supabase/supabase.js'),
    copy('@supabase/supabase-js/LICENSE', 'supabase/LICENSE'),
    copy('dompurify/dist/purify.min.js', 'dompurify/purify.min.js'),
    copy('dompurify/LICENSE', 'dompurify/LICENSE'),
    copy('lucide-static/LICENSE', 'lucide/LICENSE')
]);

const iconNames = [
    'bold',
    'files',
    'folder-plus',
    'heading-2',
    'italic',
    'layout-list',
    'link',
    'list',
    'list-ordered',
    'menu',
    'moon',
    'panel-left-close',
    'panel-left-open',
    'pen-line',
    'quote',
    'redo-2',
    'sun',
    'undo-2',
    'user-plus',
    'users',
    'x'
];

await Promise.all(iconNames.map(name => copy(
    `lucide-static/icons/${name}.svg`,
    `lucide/icons/${name}.svg`
)));

const fontWeights = [300, 400, 500, 600, 700, 800, 900];
const fontFiles = fontWeights.flatMap(weight => [
    `montserrat-latin-${weight}-normal.woff2`,
    `montserrat-latin-ext-${weight}-normal.woff2`
]);

await Promise.all([
    ...fontFiles.map(file => copy(
        `@fontsource/montserrat/files/${file}`,
        `montserrat/files/${file}`
    )),
    copy('@fontsource/montserrat/LICENSE', 'montserrat/LICENSE')
]);

const latinRange = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const latinExtRange = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const fontCss = fontWeights.flatMap(weight => [
    `@font-face {\n  font-family: 'Montserrat';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${weight};\n  src: url('./files/montserrat-latin-ext-${weight}-normal.woff2') format('woff2');\n  unicode-range: ${latinExtRange};\n}`,
    `@font-face {\n  font-family: 'Montserrat';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${weight};\n  src: url('./files/montserrat-latin-${weight}-normal.woff2') format('woff2');\n  unicode-range: ${latinRange};\n}`
]).join('\n\n');

await mkdir(join(vendor, 'montserrat'), { recursive: true });
await writeFile(join(vendor, 'montserrat', 'montserrat.css'), `${fontCss}\n`, 'utf8');

console.log('Pinned browser assets copied to assets/vendor.');
