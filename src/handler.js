import Bottleneck from 'bottleneck';
import https from 'https';
import mime from 'mime-types';
import path from 'path';
import { URL } from 'url';
import { getDrive } from './auth.js';

const MAX_FILE_SIZE = 5120 * 1024 * 1024 * 1024; // 5,120 GB in bytes

const limiter = new Bottleneck({
    reservoir: 150,
    reservoirRefreshAmount: 150,
    reservoirRefreshInterval: 1000,
    retryDelay: retryCount => Math.min(1000 * 2 ** retryCount, 30000)
});

limiter.on('failed', async (error, jobInfo) => {
    if (error && error.statusCode === 429 && jobInfo.retryCount < 5) {
        console.warn(`429 on job ${jobInfo.options.id}, retry #${jobInfo.retryCount + 1}`);
        return true;
    }
    return false;
});

async function getFileFromUrl(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
        if (!urlRegex.test(url)) {
            reject(new Error(`Invalid URL format: ${url}`));
            return;
        }
        const fileName = path.basename(parsed.pathname) || `unknown_${Date.now()}`;
        const req = https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Download failed: ${res.statusCode}`));
                return;
            }
            const len = res.headers['content-length'];
            const fileSize = len ? parseInt(len, 10) : null;
            if (fileSize && fileSize > MAX_FILE_SIZE) {
                reject(new Error(`File size ${fileSize} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`));
                return;
            }
            resolve({ stream: res, fileName, fileSize });
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Download timed out after ${timeout}ms`));
        });
    });
}

async function uploadFileToDrive({ stream, fileName, fileSize }) {
    const drive = getDrive();
    const mimeType = mime.lookup(fileName) || 'application/octet-stream';
    console.log(`Uploading file ${fileName} with MIME type ${mimeType}`);
    return limiter.schedule(() =>
        drive.files.create(
            {
                requestBody: { name: fileName },
                media: {
                    mimeType,
                    body: stream
                },
                fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime'
            },
            {
                onUploadProgress: progressEvent => {
                    if (fileSize) {
                        const percentComplete = (progressEvent.bytesRead / fileSize) * 100;
                        console.log(`Uploading ${fileName}: ${percentComplete.toFixed(1)}%`);
                        if (percentComplete >= 100) console.log(`${fileName} upload complete!`);
                    }
                }
            }
        )
    );
}

async function listFiles() {
    const drive = getDrive();
    const response = await drive.files.list({
        q: "'me' in owners and trashed = false",
        fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)'
    });
    return response.data;
}

async function uploadFiles(urls) {
    return Promise.all(
        urls.map(async url => {
            try {
                const fileData = await getFileFromUrl(url);
                const response = await uploadFileToDrive(fileData);
                return {
                    url,
                    status: 'success',
                    fileId: response.data.id,
                    fileName: response.data.name
                };
            } catch (err) {
                console.error(`Error for ${url}:`, err.message);
                return { url, status: 'error', error: err.message };
            }
        })
    );
}

export { getFileFromUrl, uploadFileToDrive, listFiles, uploadFiles };