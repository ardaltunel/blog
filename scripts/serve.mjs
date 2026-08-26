import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HOST = '127.0.0.1';
const requestedPort = Number.parseInt(process.env.PORT || '5500', 10);
const PORT = Number.isSafeInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536
    ? requestedPort
    : 5500;

const CONTENT_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=utf-8']
]);

const safePath = pathname => {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    const relativePath = decoded.replace(/^\/+/, '') || 'index.html';
    const candidate = resolve(ROOT, relativePath);
    return candidate === ROOT || candidate.startsWith(`${ROOT}${sep}`) ? candidate : null;
};

const existingFile = async pathname => {
    const candidates = [pathname];
    if (pathname === '/blog' || pathname.startsWith('/blog/')) {
        candidates.push(pathname.slice('/blog'.length) || '/');
    }

    for (const candidatePath of candidates) {
        const candidate = safePath(candidatePath);
        if (!candidate) {
            continue;
        }

        try {
            const details = await stat(candidate);
            if (details.isDirectory()) {
                const indexFile = join(candidate, 'index.html');
                await access(indexFile);
                return indexFile;
            }
            if (details.isFile()) {
                return candidate;
            }
        } catch {
            // Try the next local route candidate.
        }
    }

    return null;
};

const sendFile = (request, response, filePath, statusCode = 200) => {
    response.writeHead(statusCode, {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': CONTENT_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
        'Expires': '0',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
    });

    if (request.method === 'HEAD') {
        response.end();
        return;
    }

    const stream = createReadStream(filePath);
    stream.on('error', () => {
        if (!response.headersSent) {
            response.writeHead(500);
        }
        response.end('Internal Server Error');
    });
    stream.pipe(response);
};

const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end('Method Not Allowed');
        return;
    }

    const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
    const filePath = await existingFile(url.pathname);
    if (filePath) {
        sendFile(request, response, filePath);
        return;
    }

    const isAssetRequest = extname(url.pathname) !== '';
    sendFile(request, response, join(ROOT, '404.html'), isAssetRequest ? 404 : 200);
});

server.listen(PORT, HOST, () => {
    process.stdout.write(`Development server: http://${HOST}:${PORT}/\n`);
});
