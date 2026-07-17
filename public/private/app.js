document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let activeConversation = null;
    let cachedPasscode = null; // Stored in sessionStorage for persistence
    let pollInterval = null;

    // DOM Elements
    const appContainer = document.getElementById('app-container');
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Sidebar Tabs
    const tabChatBtn = document.getElementById('tabChatBtn');
    const tabSettingsBtn = document.getElementById('tabSettingsBtn');
    const tabAdminBtn = document.getElementById('tabAdminBtn');
    const sidebarChatView = document.getElementById('sidebarChatView');
    const sidebarSettingsView = document.getElementById('sidebarSettingsView');
    const sidebarAdminView = document.getElementById('sidebarAdminView');

    // Sidebar Lists
    const createChatBtn = document.getElementById('createChatBtn');
    const conversationsList = document.getElementById('conversationsList');
    const adminMenuButtons = document.querySelectorAll('.admin-menu .menu-btn');

    // Content Views
    const welcomeView = document.getElementById('welcomeView');
    const chatView = document.getElementById('chatView');
    const adminView = document.getElementById('adminView');
    const adminPanelContent = document.getElementById('adminPanelContent');
    const settingsView = document.getElementById('settingsView');

    // Settings Panel Inputs
    const settingsUsernameInput = document.getElementById('settingsUsernameInput');
    const settingsDisplayNameInput = document.getElementById('settingsDisplayNameInput');
    const settingsPasswordInput = document.getElementById('settingsPasswordInput');
    const settingsConfirmPasswordInput = document.getElementById('settingsConfirmPasswordInput');
    const settingsConfirmPasswordGroup = document.getElementById('settingsConfirmPasswordGroup');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsMessage = document.getElementById('settingsMessage');

    // Chat Interface
    const activeChatName = document.getElementById('activeChatName');
    const activeChatMembers = document.getElementById('activeChatMembers');
    const keyStatusIndicator = document.getElementById('keyStatusIndicator');
    const setChannelKeyBtn = document.getElementById('setChannelKeyBtn');
    const decryptionOverlay = document.getElementById('decryptionOverlay');
    const channelKeyInput = document.getElementById('channelKeyInput');
    const submitChannelKeyBtn = document.getElementById('submitChannelKeyBtn');
    const messagesContainer = document.getElementById('messagesContainer');

    // Room Action Dropdown Menu
    const chatMenuBtn = document.getElementById('chatMenuBtn');
    const chatMenuDropdown = document.getElementById('chatMenuDropdown');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    
    const chatInputBar = document.getElementById('chatInputBar');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const attachmentPreview = document.getElementById('attachmentPreview');
    const attachmentName = document.getElementById('attachmentName');
    const removeAttachmentBtn = document.getElementById('removeAttachmentBtn');

    // Modals
    const createChatModal = document.getElementById('createChatModal');
    const chatTypeSelect = document.getElementById('chatTypeSelect');
    const groupNameField = document.getElementById('groupNameField');
    const chatNameInput = document.getElementById('chatNameInput');
    const chatMembersInput = document.getElementById('chatMembersInput');
    const chatPasscodeInput = document.getElementById('chatPasscodeInput');
    const cancelCreateChatBtn = document.getElementById('cancelCreateChatBtn');
    const submitCreateChatBtn = document.getElementById('submitCreateChatBtn');

    let pendingFile = null;

    // -------------------------------------------------------------
    // INIT & AUTH CHECK
    // -------------------------------------------------------------
    async function initApp() {
        try {
            const res = await fetch('/api/auth/session');
            if (!res.ok) {
                window.location.href = '/?auth=required';
                return;
            }
            const data = await res.json();
            currentUser = data.user;
            currentUserDisplay.textContent = `${currentUser.displayName} (@${currentUser.username})`;

            if (currentUser.role === 'admin') {
                tabAdminBtn.style.display = 'block';
            }

            // Bind Event Listeners
            setupEventListeners();
            
            // Load Conversations
            await loadConversations();
        } catch (err) {
            console.error("Initialization failed:", err);
            window.location.href = '/?auth=required';
        }
    }

    // -------------------------------------------------------------
    // EVENT LISTENERS
    // -------------------------------------------------------------
    function setupEventListeners() {
        // Logout
        logoutBtn.addEventListener('click', handleLogout);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                handleLogout();
            }
        });

        // Sidebar Tabs Switcher
        tabChatBtn.addEventListener('click', () => {
            tabChatBtn.classList.add('active');
            tabSettingsBtn.classList.remove('active');
            tabAdminBtn.classList.remove('active');
            sidebarChatView.classList.add('active');
            sidebarSettingsView.classList.remove('active');
            sidebarAdminView.classList.remove('active');
            appContainer.className = 'show-sidebar';
        });

        tabSettingsBtn.addEventListener('click', () => {
            tabSettingsBtn.classList.add('active');
            tabChatBtn.classList.remove('active');
            tabAdminBtn.classList.remove('active');
            sidebarSettingsView.classList.add('active');
            sidebarChatView.classList.remove('active');
            sidebarAdminView.classList.remove('active');
            showSettingsPanel();
        });

        tabAdminBtn.addEventListener('click', () => {
            tabAdminBtn.classList.add('active');
            tabChatBtn.classList.remove('active');
            tabSettingsBtn.classList.remove('active');
            sidebarAdminView.classList.add('active');
            sidebarChatView.classList.remove('active');
            sidebarSettingsView.classList.remove('active');
            
            // Show default admin panel
            const activeAdminBtn = document.querySelector('.admin-menu .menu-btn.active');
            if (activeAdminBtn) {
                showAdminPanel(activeAdminBtn.dataset.view);
            }
        });

        // Create Chat Modal triggers
        createChatBtn.addEventListener('click', () => {
            createChatModal.classList.add('active');
            chatNameInput.value = '';
            chatMembersInput.value = '';
            chatPasscodeInput.value = '';
            chatTypeSelect.value = 'direct';
            groupNameField.style.display = 'none';
        });

        chatTypeSelect.addEventListener('change', () => {
            groupNameField.style.display = chatTypeSelect.value === 'group' ? 'block' : 'none';
        });

        cancelCreateChatBtn.addEventListener('click', () => {
            createChatModal.classList.remove('active');
        });

        submitCreateChatBtn.addEventListener('click', handleCreateConversation);
        saveSettingsBtn.addEventListener('click', handleSaveSettings);
        settingsPasswordInput.addEventListener('input', () => {
            const hasPasswordVal = settingsPasswordInput.value.length > 0;
            settingsConfirmPasswordGroup.style.display = hasPasswordVal ? 'block' : 'none';
            if (!hasPasswordVal) {
                settingsConfirmPasswordInput.value = '';
            }
        });

        // Mobile Back Buttons
        document.querySelectorAll('.mobile-back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                appContainer.className = 'show-sidebar';
                
                // Synchronize sidebar active tab highlight back to Chats
                tabChatBtn.classList.add('active');
                tabSettingsBtn.classList.remove('active');
                tabAdminBtn.classList.remove('active');
                sidebarChatView.classList.add('active');
                sidebarSettingsView.classList.remove('active');
                sidebarAdminView.classList.remove('active');
            });
        });

        // Room Menu Dropdown Toggles
        chatMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatMenuDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            chatMenuDropdown.classList.remove('show');
        });

        leaveRoomBtn.addEventListener('click', handleLeaveRoom);
        deleteRoomBtn.addEventListener('click', handleDeleteRoom);

        // Decrypt Passcode Form
        submitChannelKeyBtn.addEventListener('click', handlePasscodeSubmit);
        channelKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handlePasscodeSubmit();
        });

        setChannelKeyBtn.addEventListener('click', () => {
            decryptionOverlay.style.display = 'flex';
            channelKeyInput.value = '';
            channelKeyInput.focus();
        });

        // Message input enter key
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        sendMessageBtn.addEventListener('click', handleSendMessage);

        // File upload triggers
        fileUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                pendingFile = file;
                attachmentName.textContent = file.name;
                attachmentPreview.style.display = 'flex';
            }
        });

        removeAttachmentBtn.addEventListener('click', () => {
            pendingFile = null;
            fileUploadInput.value = '';
            attachmentPreview.style.display = 'none';
        });

        // Admin view buttons mapping
        adminMenuButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                adminMenuButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showAdminPanel(btn.dataset.view);
            });
        });
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error("Logout fetch error:", err);
        }
        sessionStorage.clear();
        window.location.href = '/';
    }

    // -------------------------------------------------------------
    // CHAT CONVERSATIONS MANAGEMENT
    // -------------------------------------------------------------
    async function loadConversations() {
        try {
            const res = await fetch('/api/conversations');
            const conversations = await res.json();
            
            conversationsList.innerHTML = '';
            if (conversations.length === 0) {
                conversationsList.innerHTML = '<div class="placeholder-text">No active channels.</div>';
                return;
            }

            conversations.forEach(c => {
                const item = document.createElement('div');
                item.className = 'conv-item';
                if (activeConversation && activeConversation.id === c.id) {
                    item.classList.add('active');
                }

                // Render name
                let name = c.name;
                if (c.type === 'direct') {
                    const peer = c.members.find(m => m.userId !== currentUser.id);
                    name = peer ? peer.displayName : 'Direct Message';
                }

                const lastMsgText = c.lastMessage ? '[Encrypted Message]' : 'No messages yet';

                item.innerHTML = `
                    <div class="conv-title">${escapeHTML(name)}</div>
                    <div class="conv-meta">
                        <span>${c.type}</span>
                        <span>${c.members.length} members</span>
                    </div>
                `;

                item.addEventListener('click', () => selectConversation(c));
                conversationsList.appendChild(item);
            });
        } catch (err) {
            console.error("Load conversations error:", err);
        }
    }

    async function handleCreateConversation() {
        const type = chatTypeSelect.value;
        const name = chatNameInput.value.trim();
        const membersRaw = chatMembersInput.value.trim();
        const passcode = chatPasscodeInput.value;

        if (type === 'group' && !name) {
            showNotification('Group name required.', 'error');
            return;
        }
        if (!passcode) {
            showNotification('Passcode required for E2EE authentication.', 'error');
            return;
        }

        const memberUsernames = membersRaw ? membersRaw.split(',').map(m => m.trim()) : [];

        try {
            const res = await fetch('/api/conversations/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, memberUsernames })
            });

            if (res.ok) {
                const conv = await res.json();
                
                // Cache derived key passcode locally
                sessionStorage.setItem(`e2ee_key_${conv.id}`, passcode);
                
                createChatModal.classList.remove('active');
                await loadConversations();
                selectConversation(conv);
            } else {
                const err = await res.json();
                showNotification(`Failed: ${err.error}`, 'error');
            }
        } catch (err) {
            showNotification('Network error.', 'error');
        }
    }

    async function selectConversation(conv) {
        activeConversation = conv;
        appContainer.className = 'show-content';
        
        // Update sidebar visual active item
        document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
        await loadConversations(); // refresh list

        // Update main panels view
        welcomeView.classList.remove('active');
        adminView.classList.remove('active');
        settingsView.classList.remove('active');
        chatView.classList.add('active');

        // Render header details
        let name = conv.name;
        if (conv.type === 'direct') {
            const peer = conv.members.find(m => m.userId !== currentUser.id);
            name = peer ? peer.displayName : 'Direct Message';
        }
        activeChatName.textContent = name;
        activeChatMembers.textContent = `Members: ${conv.members.map(m => m.displayName).join(', ')}`;

        // Check for cached key
        cachedPasscode = sessionStorage.getItem(`e2ee_key_${conv.id}`);
        if (!cachedPasscode) {
            decryptionOverlay.style.display = 'flex';
            keyStatusIndicator.textContent = 'E2EE Locked';
            keyStatusIndicator.className = 'security-tag unverified';
            channelKeyInput.value = '';
            channelKeyInput.focus();
            messagesContainer.innerHTML = '';
            stopPolling();
        } else {
            decryptionOverlay.style.display = 'none';
            keyStatusIndicator.textContent = 'E2EE Secure';
            keyStatusIndicator.className = 'security-tag verified';
            
            // Fetch and render messages
            await fetchAndRenderMessages();
            startPolling();
        }
    }

    async function handleLeaveRoom() {
        if (!activeConversation) return;
        if (activeConversation.type === 'direct') {
            showNotification('Cannot leave direct message channels.', 'error');
            return;
        }

        if (!confirm('Are you sure you want to leave this conversation group?')) return;

        try {
            const res = await fetch(`/api/conversations/${activeConversation.id}/leave`, { method: 'POST' });
            if (res.ok) {
                showNotification('Left the conversation group successfully.', 'success');
                resetChatViewState();
            } else {
                const data = await res.json();
                showNotification(`Error: ${data.error || 'Failed to leave room'}`, 'error');
            }
        } catch (err) {
            showNotification('Network error.', 'error');
        }
    }

    async function handleDeleteRoom() {
        if (!activeConversation) return;

        // Check if user is creator of room or admin
        if (activeConversation.createdBy !== currentUser.id && currentUser.role !== 'admin') {
            showNotification('Only the room creator or administrators can delete this channel.', 'error');
            return;
        }

        const confirmMsg = activeConversation.type === 'direct'
            ? 'Are you sure you want to close/delete this DM? This will permanently delete all messages and files.'
            : 'Are you sure you want to delete this room? This will permanently delete all E2EE messages, files, and member nodes.';
        
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/conversations/${activeConversation.id}/delete`, { method: 'POST' });
            if (res.ok) {
                showNotification('Conversation deleted successfully.', 'success');
                resetChatViewState();
            } else {
                const data = await res.json();
                showNotification(`Error: ${data.error || 'Failed to delete room'}`, 'error');
            }
        } catch (err) {
            showNotification('Network error.', 'error');
        }
    }

    function resetChatViewState() {
        activeConversation = null;
        stopPolling();
        
        // Hide chatView and show welcomeView
        chatView.classList.remove('active');
        welcomeView.classList.add('active');
        
        // Go back to sidebar layout on mobile
        appContainer.className = 'show-sidebar';
        
        // Refresh conversations list
        loadConversations();
    }

    // -------------------------------------------------------------
    // E2EE PASSCODE HANDLING
    // -------------------------------------------------------------
    async function handlePasscodeSubmit() {
        const passcode = channelKeyInput.value.trim();
        if (!passcode) return;

        // Verify key hash against existing messages if any
        try {
            const res = await fetch(`/api/conversations/${activeConversation.id}/messages`);
            const messages = await res.json();
            
            const firstWithKey = messages.find(m => m.keyHash);
            if (firstWithKey) {
                const targetHash = await window.CryptoClient.hashKey(passcode);
                if (firstWithKey.keyHash !== targetHash) {
                    showNotification("Invalid passcode. Decryption failed.", 'error');
                    return;
                }
            }

            // Save key
            sessionStorage.setItem(`e2ee_key_${activeConversation.id}`, passcode);
            cachedPasscode = passcode;
            decryptionOverlay.style.display = 'none';
            keyStatusIndicator.textContent = 'E2EE Secure';
            keyStatusIndicator.className = 'security-tag verified';

            await fetchAndRenderMessages();
            startPolling();
        } catch (err) {
            console.error("Passcode check error:", err);
            showNotification("Database connection error verification.", 'error');
        }
    }

    // -------------------------------------------------------------
    // MESSAGING LOGIC
    // -------------------------------------------------------------
    async function fetchAndRenderMessages() {
        if (!activeConversation || !cachedPasscode) return;

        try {
            const res = await fetch(`/api/conversations/${activeConversation.id}/messages`);
            if (!res.ok) return;

            const messages = await res.json();
            
            // Keep track of scroll position
            const shouldScroll = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;

            messagesContainer.innerHTML = '';
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="placeholder-text">Conversation established. Messages are client-side encrypted.</div>';
                return;
            }

            for (let msg of messages) {
                const msgEl = document.createElement('div');
                msgEl.className = 'msg-wrapper';
                msgEl.classList.add(msg.senderId === currentUser.id ? 'sent' : 'received');

                let content = '';
                let isDecrypted = true;

                if (msg.deletedAt) {
                    content = '<span class="muted font-italic">This message was deleted.</span>';
                    isDecrypted = false;
                } else {
                    try {
                        content = await window.CryptoClient.decryptMessage(cachedPasscode, msg.encryptedContent, msg.iv);
                    } catch (e) {
                        content = '<span class="muted">[Decryption Failed: wrong passcode or format]</span>';
                        isDecrypted = false;
                    }
                }

                const timestamp = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                msgEl.innerHTML = `
                    <div class="msg-meta">
                        <strong>${escapeHTML(msg.displayName)}</strong>
                        <span class="muted">${timestamp}</span>
                        ${isDecrypted && msg.senderId === currentUser.id ? `<button class="delete-msg-btn small-btn text-btn" data-id="${msg.id}">x</button>` : ''}
                    </div>
                    <div class="msg-bubble">${content}</div>
                `;

                // Add delete listener
                const deleteBtn = msgEl.querySelector('.delete-msg-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => handleDeleteMessage(msg.id));
                }

                messagesContainer.appendChild(msgEl);
            }

            // Check if there are associated encrypted files
            await renderFilesList(messagesContainer);

            if (shouldScroll) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (err) {
            console.error("Fetch messages error:", err);
        }
    }

    async function renderFilesList(container) {
        // Fetch files for this conversation (We can get file records from database)
        try {
            const res = await fetch(`/api/conversations/${activeConversation.id}/files`);
            if (res.ok) {
                const data = await res.json();
                const conversationFiles = data.files;
                if (conversationFiles.length > 0) {
                    const divider = document.createElement('div');
                    divider.className = 'msg-bubble system-msg';
                    divider.textContent = '--- Shared Files ---';
                    container.appendChild(divider);

                    conversationFiles.forEach(file => {
                        const fileEl = document.createElement('div');
                        fileEl.className = 'msg-wrapper received';
                        fileEl.innerHTML = `
                            <div class="msg-meta">
                                <strong>File Attachment</strong>
                                <span class="muted">${new Date(file.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="file-attachment">
                                <span class="file-icon">📄</span>
                                <a class="file-download-link" data-id="${file.id}" data-filename="${file.filename}">${escapeHTML(file.filename)} (${formatBytes(file.size)})</a>
                            </div>
                        `;

                        fileEl.querySelector('.file-download-link').addEventListener('click', (e) => {
                            e.preventDefault();
                            handleFileDownload(file.id, file.filename);
                        });

                        container.appendChild(fileEl);
                    });
                }
            }
        } catch (err) {
            console.error("Failed to load conversation files:", err);
        }
    }

    async function handleSendMessage() {
        const text = messageInput.value.trim();
        if (!text && !pendingFile) return;

        messageInput.value = '';
        
        try {
            const passcode = cachedPasscode;
            const keyHash = await window.CryptoClient.hashKey(passcode);

            // Handle file upload first if present
            if (pendingFile) {
                // Read file
                const reader = new FileReader();
                reader.onload = async () => {
                    const arrayBuffer = reader.result;
                    const { encryptedData, iv } = await window.CryptoClient.encryptFile(passcode, arrayBuffer);
                    
                    const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
                    
                    const formData = new FormData();
                    formData.append('conversationId', activeConversation.id);
                    formData.append('iv', iv);
                    formData.append('file', blob, pendingFile.name);

                    const uploadRes = await fetch('/api/files/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (uploadRes.ok) {
                        pendingFile = null;
                        attachmentPreview.style.display = 'none';
                        fileUploadInput.value = '';
                        await fetchAndRenderMessages();
                    } else {
                        showNotification("File upload failed.", 'error');
                    }
                };
                reader.readAsArrayBuffer(pendingFile);
                return;
            }

            // Encrypt message
            const { ciphertext, iv } = await window.CryptoClient.encryptMessage(passcode, text);

            const res = await fetch(`/api/conversations/${activeConversation.id}/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryptedContent: ciphertext, iv, keyHash })
            });

            if (res.ok) {
                await fetchAndRenderMessages();
            } else {
                console.error("Message send failed.");
            }
        } catch (err) {
            console.error("Encrypt and send error:", err);
        }
    }

    async function handleDeleteMessage(id) {
        if (!confirm("Are you sure you want to delete this message?")) return;
        try {
            const res = await fetch(`/api/messages/${id}/delete`, { method: 'POST' });
            if (res.ok) {
                await fetchAndRenderMessages();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleFileDownload(fileId, filename) {
        try {
            const res = await fetch(`/api/files/download/${fileId}`);
            if (!res.ok) {
                showNotification("Failed to download file or unauthorized.", 'error');
                return;
            }

            const iv = res.headers.get('X-File-IV');
            const encryptedBuffer = await res.arrayBuffer();

            const decryptedBuffer = await window.CryptoClient.decryptFile(cachedPasscode, encryptedBuffer, iv);
            const blob = new Blob([decryptedBuffer]);
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        } catch (err) {
            console.error("Download decryption error:", err);
            showNotification("Failed to decrypt file. Passcode mismatch.", 'error');
        }
    }

    // -------------------------------------------------------------
    // POLLING ENGINE
    // -------------------------------------------------------------
    function startPolling() {
        stopPolling();
        pollInterval = setInterval(fetchAndRenderMessages, 3000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // -------------------------------------------------------------
    // ADMIN PORTAL VIEWS
    // -------------------------------------------------------------
    async function showAdminPanel(view) {
        welcomeView.classList.remove('active');
        chatView.classList.remove('active');
        settingsView.classList.remove('active');
        adminView.classList.add('active');
        appContainer.className = 'show-content';

        // Stop polling chat messages in admin panel
        stopPolling();

        adminPanelContent.innerHTML = '<p class="placeholder-text">Loading console data...</p>';

        try {
            if (view === 'users') {
                const res = await fetch('/api/admin/users');
                const users = await res.json();
                renderUsersPanel(users);
            } else if (view === 'invitations') {
                const res = await fetch('/api/admin/invitations');
                const invites = await res.json();
                renderInvitationsPanel(invites);
            } else if (view === 'sessions') {
                const res = await fetch('/api/admin/sessions');
                const sessions = await res.json();
                renderSessionsPanel(sessions);
            } else if (view === 'storage') {
                const storageRes = await fetch('/api/admin/storage');
                const storageData = await storageRes.json();
                const logsRes = await fetch('/api/admin/logs');
                const logs = await logsRes.json();
                renderStorageLogsPanel(storageData, logs);
            }
        } catch (err) {
            adminPanelContent.innerHTML = '<p style="color: #ff5555">Error fetching admin console data.</p>';
        }
    }

    function renderUsersPanel(users) {
        adminPanelContent.innerHTML = `
            <div class="admin-section">
                <h4>Create New User Account</h4>
                <div class="admin-card" style="max-width: 500px;">
                    <div class="form-group">
                        <label>Username:</label>
                        <input type="text" id="adminUserUsername" class="terminal-input">
                    </div>
                    <div class="form-group">
                        <label>Display Name:</label>
                        <input type="text" id="adminUserDisplayName" class="terminal-input">
                    </div>
                    <div class="form-group">
                        <label>Password:</label>
                        <input type="password" id="adminUserPassword" class="terminal-input">
                    </div>
                    <div class="form-group">
                        <label>Role:</label>
                        <select id="adminUserRole" class="terminal-input">
                            <option value="user">User</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    <button id="adminCreateUserBtn" class="terminal-btn">Create User</button>
                </div>
            </div>
            <div class="admin-section">
                <h4>Registered Users</h4>
                <table class="terminal-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Display Name</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>${escapeHTML(u.username)}</td>
                                <td>${escapeHTML(u.displayName)}</td>
                                <td>${u.role}</td>
                                <td><span style="color: ${u.status === 'active' ? '#00ff99' : '#ff5555'}">${u.status}</span></td>
                                <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${u.id !== currentUser.id ? `
                                        <button class="suspend-user-btn small-btn terminal-btn" data-id="${u.id}" data-status="${u.status}">
                                            ${u.status === 'active' ? 'Suspend' : 'Activate'}
                                        </button>
                                        <button class="delete-user-btn small-btn text-btn" data-id="${u.id}">Delete</button>
                                    ` : 'Current Account'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('adminCreateUserBtn').addEventListener('click', handleAdminCreateUser);
        
        document.querySelectorAll('.suspend-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const status = btn.dataset.status === 'active' ? 'suspended' : 'active';
                handleAdminSuspendUser(id, status);
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleAdminDeleteUser(btn.dataset.id);
            });
        });
    }

    async function handleAdminCreateUser() {
        const username = document.getElementById('adminUserUsername').value.trim();
        const displayName = document.getElementById('adminUserDisplayName').value.trim();
        const password = document.getElementById('adminUserPassword').value;
        const role = document.getElementById('adminUserRole').value;

        try {
            const res = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, displayName, password, role })
            });

            if (res.ok) {
                showNotification("User created successfully.", 'success');
                showAdminPanel('users');
            } else {
                const data = await res.json();
                showNotification(`Error: ${data.error}`, 'error');
            }
        } catch (err) {
            showNotification("Network error.", 'error');
        }
    }

    async function handleAdminSuspendUser(userId, status) {
        try {
            const res = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                showAdminPanel('users');
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAdminDeleteUser(userId) {
        if (!confirm("Are you sure you want to delete this user? This operation is permanent.")) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}/delete`, { method: 'POST' });
            if (res.ok) {
                showAdminPanel('users');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderInvitationsPanel(invites) {
        adminPanelContent.innerHTML = `
            <div class="admin-section">
                <h4>Generate Invitation Token</h4>
                <p class="muted">Tokens are one-time use keys valid for onboarding a new secure contact.</p><br>
                <button id="adminGenerateTokenBtn" class="terminal-btn">Generate One-Time Token</button>
            </div>
            <div class="admin-section">
                <h4>Tokens Registry</h4>
                <table class="terminal-table">
                    <thead>
                        <tr>
                            <th>Token Key</th>
                            <th>Expires</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invites.map(i => {
                            let status = 'Unused';
                            let color = '#00ff99';
                            if (i.usedAt) {
                                status = `Claimed (${new Date(i.usedAt).toLocaleDateString()})`;
                                color = '#888';
                            } else if (i.revokedAt) {
                                status = 'Revoked';
                                color = '#ff5555';
                            } else if (new Date(i.expiresAt) < new Date()) {
                                status = 'Expired';
                                color = '#ff5555';
                            }

                            return `
                                <tr>
                                    <td><code>${i.token}</code></td>
                                    <td>${new Date(i.expiresAt).toLocaleString()}</td>
                                    <td><span style="color: ${color}">${status}</span></td>
                                    <td>
                                        ${(!i.usedAt && !i.revokedAt) ? `<button class="revoke-invite-btn small-btn text-btn" data-id="${i.id}">Revoke</button>` : '---'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('adminGenerateTokenBtn').addEventListener('click', handleAdminGenerateToken);
        document.querySelectorAll('.revoke-invite-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleAdminRevokeInvitation(btn.dataset.id);
            });
        });
    }

    async function handleAdminGenerateToken() {
        try {
            const res = await fetch('/api/admin/invitations/generate', { method: 'POST' });
            if (res.ok) {
                showAdminPanel('invitations');
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAdminRevokeInvitation(id) {
        try {
            const res = await fetch(`/api/admin/invitations/${id}/revoke`, { method: 'POST' });
            if (res.ok) {
                showAdminPanel('invitations');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderSessionsPanel(sessions) {
        adminPanelContent.innerHTML = `
            <div class="admin-section">
                <h4>Active Authenticated Nodes</h4>
                <table class="terminal-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>IP Address</th>
                            <th>Login Date</th>
                            <th>Last Active</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sessions.map(s => `
                            <tr>
                                <td>@${escapeHTML(s.username)}</td>
                                <td><code>${s.ipAddress}</code></td>
                                <td>${new Date(s.createdAt).toLocaleString()}</td>
                                <td>${new Date(s.lastActiveAt).toLocaleTimeString()}</td>
                                <td>
                                    <button class="revoke-session-btn small-btn text-btn" data-id="${s.id}">Terminate</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.revoke-session-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleAdminRevokeSession(btn.dataset.id);
            });
        });
    }

    async function handleAdminRevokeSession(id) {
        if (!confirm("Terminate this session? User will be disconnected immediately.")) return;
        try {
            const res = await fetch(`/api/admin/sessions/${id}/revoke`, { method: 'POST' });
            if (res.ok) {
                showAdminPanel('sessions');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderStorageLogsPanel(storageData, logs) {
        adminPanelContent.innerHTML = `
            <div class="admin-section">
                <h4>Storage Overview</h4>
                <div class="admin-grid">
                    <div class="admin-card">
                        <h5>Total Space Used</h5>
                        <p style="font-size: 24px; font-weight: bold; margin-top: 10px;">${formatBytes(storageData.totalSize)}</p>
                        <p class="muted" style="margin-top: 5px;">Across ${storageData.count} files</p>
                    </div>
                </div>
            </div>
            <div class="admin-section">
                <h4>Audit Trail Log</h4>
                <div style="background: rgba(10,10,10,0.8); padding: 15px; border-radius: 4px; border: 1px solid rgba(0, 255, 153, 0.2); max-height: 400px; overflow-y: auto;">
                    ${logs.map(l => `
                        <div style="font-size: 12px; line-height: 1.6; border-bottom: 1px solid rgba(0, 255, 153, 0.05); padding: 5px 0;">
                            <span class="muted">[${new Date(l.createdAt).toLocaleString()}]</span>
                            <span style="color: #00ff99">@${l.username}</span> 
                            <code>(${l.ipAddress})</code>: 
                            <strong>${l.eventType}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // SETTINGS PANEL
    // -------------------------------------------------------------
    function showSettingsPanel() {
        welcomeView.classList.remove('active');
        chatView.classList.remove('active');
        adminView.classList.remove('active');
        settingsView.classList.add('active');
        appContainer.className = 'show-content';
        
        stopPolling();
        
        settingsUsernameInput.value = currentUser.username;
        settingsDisplayNameInput.value = currentUser.displayName;
        settingsPasswordInput.value = '';
        settingsConfirmPasswordInput.value = '';
        settingsConfirmPasswordGroup.style.display = 'none';
        settingsMessage.innerHTML = '';
    }

    async function handleSaveSettings() {
        const username = settingsUsernameInput.value.trim();
        const displayName = settingsDisplayNameInput.value.trim();
        const password = settingsPasswordInput.value;
        const confirmPassword = settingsConfirmPasswordInput.value;
        
        if (!username || !displayName) {
            showNotification('Username and display name are required.', 'error');
            return;
        }

        if (password && password !== confirmPassword) {
            showNotification('Passwords do not match.', 'error');
            return;
        }
        
        settingsMessage.innerHTML = '<span class="muted">Saving changes...</span>';
        
        try {
            const res = await fetch('/api/users/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, displayName, password })
            });
            
            const data = await res.json();
            if (res.ok) {
                currentUser = data.user;
                currentUserDisplay.textContent = `${currentUser.displayName} (@${currentUser.username})`;
                showNotification('Profile updated successfully!', 'success');
                settingsPasswordInput.value = '';
                settingsConfirmPasswordInput.value = '';
                settingsConfirmPasswordGroup.style.display = 'none';
                settingsMessage.innerHTML = '';
            } else {
                showNotification(`Error: ${data.error || 'Failed to update'}`, 'error');
                settingsMessage.innerHTML = '';
            }
        } catch (err) {
            showNotification('Network error.', 'error');
            settingsMessage.innerHTML = '';
        }
    }

    // -------------------------------------------------------------
    // CUSTOM NOTIFICATIONS TOAST
    // -------------------------------------------------------------
    function showNotification(message, type = 'info') {
        const toast = document.getElementById('terminal-toast');
        const toastIcon = document.getElementById('toast-icon');
        const toastMsg = document.getElementById('toast-message');

        toastMsg.textContent = message;
        toastIcon.textContent = type === 'error' ? '×' : 'λ';

        toast.className = 'toast show';
        if (type === 'error') {
            toast.classList.add('error');
        } else if (type === 'success') {
            toast.classList.add('success');
        }

        // Hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // -------------------------------------------------------------
    // UTILITIES
    // -------------------------------------------------------------
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Load App
    initApp();
});
