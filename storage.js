const fs = require('fs');
const path = require('path');

class UploadcareStorageProvider {
    /**
     * Uploads encrypted file buffer to Uploadcare.
     * @param {string} fileId Unique identifier for the file.
     * @param {Buffer} buffer Encrypted file data.
     * @returns {Promise<string>} Uploadcare file UUID storage reference.
     */
    async upload(fileId, buffer) {
        try {
            const pubKey = process.env.UPLOADCARE_PUBLIC_KEY || 'c6ee39f607e7c27c7dac';
            
            // Build multipart/form-data payload manually to support all Node.js versions
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
            const parts = [];
            
            // Add UPLOADCARE_PUB_KEY part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="UPLOADCARE_PUB_KEY"\r\n\r\n` +
                `${pubKey}\r\n`
            ));
            
            // Add UPLOADCARE_STORE part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="UPLOADCARE_STORE"\r\n\r\n` +
                `0\r\n`
            ));
            
            // Add file part
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="${fileId}"\r\n` +
                `Content-Type: application/octet-stream\r\n\r\n`
            ));
            
            parts.push(buffer);
            parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
            
            const payload = Buffer.concat(parts);
            
            return new Promise((resolve, reject) => {
                const https = require('https');
                const req = https.request('https://upload.uploadcare.com/base/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': payload.length
                    }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const data = JSON.parse(body);
                                if (data.file) {
                                    resolve(data.file);
                                } else {
                                    reject(new Error("Uploadcare response did not include file UUID."));
                                }
                            } catch (e) {
                                reject(e);
                            }
                        } else {
                            reject(new Error(`Uploadcare upload failed with status ${res.statusCode}: ${body}`));
                        }
                    });
                });
                
                req.on('error', reject);
                req.write(payload);
                req.end();
            });
            
        } catch (err) {
            console.error("Uploadcare upload provider error:", err);
            throw err;
        }
    }

    /**
     * Downloads/Reads file buffer from Uploadcare CDN.
     * @param {string} storageReference The Uploadcare file UUID.
     * @returns {Promise<Buffer>} The decrypted file buffer.
     */
    async download(storageReference) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            https.get(`https://ucarecdn.com/${storageReference}/`, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Uploadcare download failed with status ${res.statusCode}`));
                    return;
                }
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
            }).on('error', reject);
        });
    }

    /**
     * Deletes file (No-op or ignore if secret key is not set).
     * @param {string} storageReference
     * @returns {Promise<void>}
     */
    async delete(storageReference) {
        // No-op to avoid requiring secret API keys for basic usage
        return Promise.resolve();
    }
}

// Instantiate storage provider
const activeProvider = new UploadcareStorageProvider();

module.exports = {
    upload: (fileId, buffer) => activeProvider.upload(fileId, buffer),
    download: (storageReference) => activeProvider.download(storageReference),
    delete: (storageReference) => activeProvider.delete(storageReference)
};
