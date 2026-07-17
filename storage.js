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
            const formData = new FormData();
            formData.append('UPLOADCARE_PUB_KEY', pubKey);
            formData.append('UPLOADCARE_STORE', '0'); // Auto-delete files after 24 hours (1 day)
            
            // Convert Buffer to Blob for standard FormData upload
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            formData.append('file', blob, fileId);

            const res = await fetch('https://upload.uploadcare.com/base/', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Uploadcare upload failed: ${res.statusText} - ${text}`);
            }

            const data = await res.json();
            if (!data.file) {
                throw new Error("Uploadcare response did not include file UUID.");
            }

            return data.file; // The storage reference is the Uploadcare file UUID
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
        try {
            const res = await fetch(`https://ucarecdn.com/${storageReference}/`);
            if (!res.ok) {
                throw new Error(`Uploadcare download failed: ${res.statusText}`);
            }

            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (err) {
            console.error("Uploadcare download provider error:", err);
            throw err;
        }
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
