"use strict";
// Postiz LocalStorage override.
// Stock uploadSimple() re-downloads a URL and returns it under FRONTEND_URL (the temporary
// ngrok OAuth host). Postiz calls it with the channel avatar on every token refresh, and
// http://localhost:4007 is unreachable from inside the container, so the refresh threw and
// the channel was flagged as needing setup ("Token expired or invalid, please reconnect").
// This version:
//  - reuses a file that is already in UPLOAD_DIRECTORY instead of downloading it again,
//  - returns new URLs under UPLOAD_PUBLIC_URL (default MAIN_URL) instead of FRONTEND_URL,
//  - never throws: if a remote image can't be fetched, it keeps the original URL.
// uploadFile() and removeFile() are unchanged from the image.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const mime_1 = tslib_1.__importDefault(require("mime"));
const path_1 = require("path");
const publicBase = () => (process.env.UPLOAD_PUBLIC_URL ||
    process.env.MAIN_URL ||
    process.env.FRONTEND_URL ||
    '').replace(/\/+$/, '');
class LocalStorage {
    constructor(uploadDirectory) {
        this.uploadDirectory = uploadDirectory;
    }
    // Public URL for `url` if it points at a file we already store, whatever its host.
    existingUpload(url) {
        let pathname;
        try {
            pathname = new URL(url).pathname;
        }
        catch {
            return undefined;
        }
        if (!pathname.startsWith('/uploads/')) {
            return undefined;
        }
        const root = (0, path_1.resolve)(this.uploadDirectory);
        const file = (0, path_1.resolve)(root, decodeURIComponent(pathname.slice('/uploads/'.length)));
        if (!file.startsWith(root + path_1.sep) || !(0, fs_1.existsSync)(file)) {
            return undefined;
        }
        return (publicBase() + '/uploads/' + (0, path_1.relative)(root, file).split(path_1.sep).join('/'));
    }
    async uploadSimple(path) {
        const existing = this.existingUpload(path);
        if (existing) {
            return existing;
        }
        try {
            const loadImage = await fetch(path);
            if (!loadImage.ok) {
                throw new Error(`HTTP ${loadImage.status}`);
            }
            const contentType = loadImage?.headers?.get('content-type') ||
                loadImage?.headers?.get('Content-Type');
            const findExtension = mime_1.default.getExtension(contentType);
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const innerPath = `/${year}/${month}/${day}`;
            const dir = `${this.uploadDirectory}${innerPath}`;
            (0, fs_1.mkdirSync)(dir, { recursive: true });
            const randomName = Array(32)
                .fill(null)
                .map(() => Math.round(Math.random() * 16).toString(16))
                .join('');
            const filePath = `${dir}/${randomName}.${findExtension}`;
            const publicPath = `${innerPath}/${randomName}.${findExtension}`;
            (0, fs_1.writeFileSync)(filePath, Buffer.from(await loadImage.arrayBuffer()));
            return publicBase() + '/uploads' + publicPath;
        }
        catch (err) {
            console.warn(`LocalStorage.uploadSimple: keeping ${path} (${err?.cause?.code || err?.message || err})`);
            return path;
        }
    }
    async uploadFile(file) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const innerPath = `/${year}/${month}/${day}`;
            const dir = `${this.uploadDirectory}${innerPath}`;
            (0, fs_1.mkdirSync)(dir, { recursive: true });
            const randomName = Array(32)
                .fill(null)
                .map(() => Math.round(Math.random() * 16).toString(16))
                .join('');
            const filePath = `${dir}/${randomName}${(0, path_1.extname)(file.originalname)}`;
            const publicPath = `${innerPath}/${randomName}${(0, path_1.extname)(file.originalname)}`;
            (0, fs_1.writeFileSync)(filePath, file.buffer);
            return {
                filename: `${randomName}${(0, path_1.extname)(file.originalname)}`,
                path: process.env.FRONTEND_URL + '/uploads' + publicPath,
                mimetype: file.mimetype,
                originalname: file.originalname,
            };
        }
        catch (err) {
            console.error('Error uploading file to Local Storage:', err);
            throw err;
        }
    }
    async removeFile(filePath) {
        return new Promise((resolve, reject) => {
            (0, fs_1.unlink)(filePath, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
exports.LocalStorage = LocalStorage;
