import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const ignored = new Set(['.git', 'node_modules', 'vendor', 'data']);
const sourceExtensions = new Set(['.html', '.js', '.mjs', '.yml', '.yaml', '.json', '.sql']);

const walk = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (ignored.has(entry.name)) {
            continue;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(path));
        } else if (sourceExtensions.has(extname(entry.name))) {
            files.push(path);
        }
    }
    return files;
};

const failures = [];
const files = await walk(root);
const dangerousJavaScript = [
    [/\.innerHTML\s*=/, 'innerHTML assignment'],
    [/\.outerHTML\s*=/, 'outerHTML assignment'],
    [/insertAdjacentHTML\s*\(/, 'insertAdjacentHTML'],
    [/document\.(?:write|writeln)\s*\(/, 'document.write'],
    [/(?:^|[^.\w])eval\s*\(/m, 'eval'],
    [/new\s+Function\s*\(/, 'new Function'],
    [/(?:setTimeout|setInterval)\s*\(\s*['"`]/, 'string timer'],
    [/createElement\s*\(\s*['"]script['"]\s*\)/, 'dynamic script element'],
    [/Object\.assign\s*\(/, 'unrestricted Object.assign'],
    [/console\.(?:log|warn|error|debug)\s*\(/, 'production console logging']
];

for (const file of files) {
    const content = await readFile(file, 'utf8');
    const name = relative(root, file).replaceAll('\\', '/');
    if (name.startsWith('assets/js/') && extname(file) === '.js') {
        dangerousJavaScript.forEach(([pattern, label]) => {
            if (pattern.test(content)) {
                failures.push(`${name}: forbidden ${label}`);
            }
        });
        if (name !== 'assets/js/security.js' && /new\s+URLSearchParams\s*\(/.test(content)) {
            failures.push(`${name}: query parsing must use SecurityUtils`);
        }
    }
    if (extname(file) === '.html') {
        if (!/http-equiv=["']Content-Security-Policy["']/i.test(content)) {
            failures.push(`${name}: missing CSP meta policy`);
        }
        if (!/name=["']referrer["']\s+content=["']strict-origin-when-cross-origin["']/i.test(content)) {
            failures.push(`${name}: missing referrer policy`);
        }
        if (/<script(?![^>]+src=)[^>]*>/i.test(content)) {
            failures.push(`${name}: inline script`);
        }
        if (/\son[a-z]+\s*=/i.test(content)) {
            failures.push(`${name}: inline event handler`);
        }
        if (/\sstyle\s*=/i.test(content)) {
            failures.push(`${name}: inline style`);
        }
        if (/(?:src|href)=["'](?:https?:)?\/\//i.test(content)) {
            failures.push(`${name}: external runtime asset`);
        }
    }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|["']service_role["']\s*[:=]\s*["'][A-Za-z0-9._-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}/.test(content)) {
        failures.push(`${name}: possible secret`);
    }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(packageJson[section] || {})) {
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
            failures.push(`package.json: ${name} is not pinned to an exact version`);
        }
    }
}

const workflows = files.filter(file => /\.github[\\/]workflows[\\/].+\.ya?ml$/.test(file));
for (const workflow of workflows) {
    const content = await readFile(workflow, 'utf8');
    for (const match of content.matchAll(/uses:\s*[^\s@]+@([^\s#]+)/g)) {
        if (!/^[0-9a-f]{40}$/.test(match[1])) {
            failures.push(`${relative(root, workflow)}: action is not pinned to a full commit SHA`);
        }
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Security pattern scan passed for ${files.length} source files.`);
}
