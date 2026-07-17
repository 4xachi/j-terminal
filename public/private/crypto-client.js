// E2EE Cryptography Client Helper using native Web Crypto API
const CryptoClient = {
    /**
     * Derives a cryptographic AES-GCM key from a user-supplied passcode using PBKDF2.
     * @param {string} passcode User passcode
     * @param {string} saltString Optional salt (default is static for simple E2EE)
     * @returns {Promise<CryptoKey>} Derived AES-GCM key
     */
    async _deriveKey(passcode, saltString = 'johnstr_e2ee_salt_key') {
        const encoder = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(passcode),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode(saltString),
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Computes a SHA-256 hash of the passcode to verify correctness without exposing the key.
     * @param {string} passcode
     * @returns {Promise<string>} Hex representation of the validation hash
     */
    async hashKey(passcode) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passcode + '_johnstr_validation_salt');
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Encrypts plaintext string using AES-GCM.
     * @param {string} passcode Encryption passcode
     * @param {string} plaintext Raw message content
     * @returns {Promise<{ciphertext: string, iv: string}>} Hex encrypted content and IV
     */
    async encryptMessage(passcode, plaintext) {
        const key = await this._deriveKey(passcode);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(plaintext)
        );

        const cipherArray = Array.from(new Uint8Array(encrypted));
        const ciphertextHex = cipherArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

        return { ciphertext: ciphertextHex, iv: ivHex };
    },

    /**
     * Decrypts ciphertext string using AES-GCM.
     * @param {string} passcode Encryption passcode
     * @param {string} ciphertextHex Hex encoded encrypted data
     * @param {string} ivHex Hex encoded IV
     * @returns {Promise<string>} Decrypted plaintext message
     */
    async decryptMessage(passcode, ciphertextHex, ivHex) {
        const key = await this._deriveKey(passcode);
        
        // Convert hex strings back to TypedArrays
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const ciphertext = new Uint8Array(ciphertextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    },

    /**
     * Encrypts file ArrayBuffer using AES-GCM.
     * @param {string} passcode Encryption passcode
     * @param {ArrayBuffer} arrayBuffer File raw buffer
     * @returns {Promise<{encryptedData: ArrayBuffer, iv: string}>} Encrypted buffer and hex IV
     */
    async encryptFile(passcode, arrayBuffer) {
        const key = await this._deriveKey(passcode);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            arrayBuffer
        );
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        return { encryptedData: encrypted, iv: ivHex };
    },

    /**
     * Decrypts file ArrayBuffer using AES-GCM.
     * @param {string} passcode Encryption passcode
     * @param {ArrayBuffer} arrayBuffer Encrypted file buffer
     * @param {string} ivHex Hex encoded IV
     * @returns {Promise<ArrayBuffer>} Decrypted file arrayBuffer
     */
    async decryptFile(passcode, arrayBuffer, ivHex) {
        const key = await this._deriveKey(passcode);
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        return await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            arrayBuffer
        );
    }
};

window.CryptoClient = CryptoClient;
