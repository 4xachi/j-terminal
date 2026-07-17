const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const storage = require('./storage');

const app = express();
const PORT = process.env.PORT || 8000;

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Session middleware
app.use(cookieSession({
    name: 'session',
    keys: ['johnstr_super_secret_key_rotation_1', 'johnstr_super_secret_key_rotation_2'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false, // Set to true in production if SSL is active
    sameSite: 'lax'
}));

// Configure Multer for secure uploads in memory before passing to storage provider
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware: Require Auth
async function requireAuth(req, res, next) {
    if (!req.session || !req.session.sessionId) {
        return res.status(401).json({ error: 'Unauthorized: Session missing' });
    }

    try {
        const sessionRecord = await db.getSessionById(req.session.sessionId);
        if (!sessionRecord || sessionRecord.revokedAt) {
            req.session = null;
            return res.status(401).json({ error: 'Unauthorized: Session revoked' });
        }

        const user = await db.getUserById(sessionRecord.userId);
        if (!user || user.status === 'suspended') {
            req.session = null;
            return res.status(401).json({ error: 'Unauthorized: User suspended or deleted' });
        }

        req.user = user;
        req.activeSession = sessionRecord;
        await db.updateSessionActivity(sessionRecord.id);
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Middleware: Require Admin
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
}

// Middleware: Require Conversation Membership
async function requireMembership(req, res, next) {
    const conversationId = req.params.id || req.body.conversationId;
    if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID required' });
    }

    try {
        const members = await db.getConversationMembers(conversationId);
        const isMember = members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden: Not a member of this conversation' });
        }
        next();
    } catch (err) {
        console.error("Membership check failed:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const user = await db.getUserByUsername(username.toLowerCase().trim());
        if (!user || user.status === 'suspended') {
            await db.createAuditLog({
                id: crypto.randomUUID(),
                userId: null,
                eventType: 'login_failed',
                ipAddress,
                createdAt: new Date().toISOString()
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passMatches) {
            await db.createAuditLog({
                id: crypto.randomUUID(),
                userId: user.id,
                eventType: 'login_failed',
                ipAddress,
                createdAt: new Date().toISOString()
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create Session
        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();
        const sessionRecord = {
            id: sessionId,
            userId: user.id,
            ipAddress,
            createdAt: now,
            lastActiveAt: now,
            revokedAt: null
        };

        await db.createSession(sessionRecord);
        req.session.sessionId = sessionId;

        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId: user.id,
            eventType: 'login_success',
            ipAddress,
            createdAt: now
        });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                role: user.role
            }
        });
    } catch (err) {
        console.error("Login route error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/users/check/:username
app.get('/api/users/check/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await db.getUserByUsername(username.toLowerCase().trim());
        if (user && user.status !== 'suspended') {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        console.error("Check username error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        await db.revokeSession(req.activeSession.id);
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId: req.user.id,
            eventType: 'logout',
            ipAddress,
            createdAt: new Date().toISOString()
        });
        req.session = null;
        res.json({ success: true });
    } catch (err) {
        console.error("Logout route error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/auth/session
app.get('/api/auth/session', requireAuth, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            displayName: req.user.displayName,
            role: req.user.role
        }
    });
});

// POST /api/users/profile
app.post('/api/users/profile', requireAuth, async (req, res) => {
    const { username, displayName, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!username || !displayName) {
        return res.status(400).json({ error: 'Username and display name are required' });
    }

    try {
        const normalizedUsername = username.toLowerCase().trim();
        
        // Input validation
        if (normalizedUsername.length < 3 || normalizedUsername.length > 20 || !/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
            return res.status(400).json({ error: 'Username must be alphanumeric, 3-20 chars long' });
        }

        // Check if username is taken by another user
        const existing = await db.getUserByUsername(normalizedUsername);
        if (existing && existing.id !== req.user.id) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        // Handle password update if provided
        let passwordHash = req.user.passwordHash;
        if (password && password.trim() !== '') {
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Update profile in DB
        await db.updateUserProfile(req.user.id, normalizedUsername, displayName.trim(), passwordHash);

        // Fetch updated user to return
        const updatedUser = await db.getUserById(req.user.id);
        
        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId: req.user.id,
            eventType: 'profile_updated',
            ipAddress,
            createdAt: new Date().toISOString()
        });

        res.json({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                displayName: updatedUser.displayName,
                role: updatedUser.role
            }
        });
    } catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -------------------------------------------------------------
// INVITATION ENDPOINTS
// -------------------------------------------------------------

// GET /api/invitations/verify/:token
app.get('/api/invitations/verify/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const inv = await db.getInvitationByToken(token);
        if (!inv || inv.usedAt || inv.revokedAt || new Date(inv.expiresAt) < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invitation token' });
        }
        res.json({ valid: true });
    } catch (err) {
        console.error("Verify invitation error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/invitations/claim
app.post('/api/invitations/claim', async (req, res) => {
    const { token, username, displayName, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!token || !username || !displayName || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const inv = await db.getInvitationByToken(token);
        if (!inv || inv.usedAt || inv.revokedAt || new Date(inv.expiresAt) < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invitation token' });
        }

        const normalizedUsername = username.toLowerCase().trim();
        if (normalizedUsername.length < 3 || normalizedUsername.length > 20 || !/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
            return res.status(400).json({ error: 'Username must be alphanumeric, 3-20 chars long' });
        }

        const existing = await db.getUserByUsername(normalizedUsername);
        if (existing) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        // Create User
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        const newUser = {
            id: userId,
            username: normalizedUsername,
            displayName: displayName.trim(),
            passwordHash,
            role: 'user',
            status: 'active'
        };

        await db.createUser(newUser);
        await db.useInvitation(token);

        // Auto Login
        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();
        const sessionRecord = {
            id: sessionId,
            userId,
            ipAddress,
            createdAt: now,
            lastActiveAt: now,
            revokedAt: null
        };
        await db.createSession(sessionRecord);
        req.session.sessionId = sessionId;

        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId,
            eventType: 'user_registered',
            ipAddress,
            createdAt: now
        });

        res.json({
            user: {
                id: newUser.id,
                username: newUser.username,
                displayName: newUser.displayName,
                role: newUser.role
            }
        });
    } catch (err) {
        console.error("Claim invitation error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -------------------------------------------------------------
// CONVERSATIONS & CHAT ENDPOINTS
// -------------------------------------------------------------

// GET /api/conversations
app.get('/api/conversations', requireAuth, async (req, res) => {
    try {
        const convs = await db.getUserConversations(req.user.id);
        
        // Fetch last message for each conversation
        const enrichedConvs = await Promise.all(convs.map(async (c) => {
            const members = await db.getConversationMembers(c.id);
            const messages = await db.getConversationMessages(c.id);
            const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
            return {
                ...c,
                members,
                lastMessage: lastMsg
            };
        }));

        res.json(enrichedConvs);
    } catch (err) {
        console.error("List conversations error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/conversations/create
app.post('/api/conversations/create', requireAuth, async (req, res) => {
    const { name, type, memberUsernames } = req.body; // type: 'direct' or 'group'
    if (!type || (type === 'group' && !name)) {
        return res.status(400).json({ error: 'Type and group name are required' });
    }

    try {
        const convId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Create conversation
        const newConv = {
            id: convId,
            name: type === 'direct' ? 'Direct Message' : name.trim(),
            type,
            createdBy: req.user.id,
            createdAt: now
        };
        await db.createConversation(newConv);

        // Add creator
        await db.addConversationMember({
            conversationId: convId,
            userId: req.user.id,
            role: 'admin',
            joinedAt: now
        });

        // Add other members
        if (Array.isArray(memberUsernames)) {
            for (let username of memberUsernames) {
                const normalized = username.toLowerCase().trim();
                if (normalized === req.user.username) continue;
                const memberUser = await db.getUserByUsername(normalized);
                if (memberUser && memberUser.status !== 'suspended') {
                    await db.addConversationMember({
                        conversationId: convId,
                        userId: memberUser.id,
                        role: 'member',
                        joinedAt: now
                    });
                }
            }
        }

        const members = await db.getConversationMembers(convId);
        res.status(201).json({ ...newConv, members });
    } catch (err) {
        console.error("Create conversation error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/conversations/:id/leave
app.post('/api/conversations/:id/leave', requireAuth, requireMembership, async (req, res) => {
    const { id } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    try {
        const conv = await db.getConversationById(id);
        if (!conv) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conv.type === 'direct') {
            return res.status(400).json({ error: 'Cannot leave direct message channels' });
        }

        const members = await db.getConversationMembers(id);
        
        // Audit log
        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId: req.user.id,
            eventType: 'leave_room',
            ipAddress,
            createdAt: new Date().toISOString()
        });

        if (members.length <= 1) {
            // Delete room completely if last member leaves
            await db.deleteConversation(id);
        } else {
            // Remove user from membership
            await db.removeConversationMember(id, req.user.id);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Leave conversation error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/conversations/:id/delete
app.post('/api/conversations/:id/delete', requireAuth, requireMembership, async (req, res) => {
    const { id } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    try {
        const conv = await db.getConversationById(id);
        if (!conv) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Only creator of group OR admin can delete it
        if (conv.createdBy !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only the room creator or administrators can delete this channel' });
        }

        // Audit log
        await db.createAuditLog({
            id: crypto.randomUUID(),
            userId: req.user.id,
            eventType: 'delete_room',
            ipAddress,
            createdAt: new Date().toISOString()
        });

        await db.deleteConversation(id);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete conversation error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', requireAuth, requireMembership, async (req, res) => {
    const { id } = req.params;
    try {
        const messages = await db.getConversationMessages(id);
        res.json(messages);
    } catch (err) {
        console.error("Get messages error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/conversations/:id/files
app.get('/api/conversations/:id/files', requireAuth, requireMembership, async (req, res) => {
    const { id } = req.params;
    try {
        const files = await db.getFilesByConversationId(id);
        res.json({ files });
    } catch (err) {
        console.error("Get files error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/conversations/:id/messages/send
app.post('/api/conversations/:id/messages/send', requireAuth, requireMembership, async (req, res) => {
    const { id } = req.params;
    const { encryptedContent, iv, keyHash } = req.body;

    if (!encryptedContent || !iv) {
        return res.status(400).json({ error: 'encryptedContent and iv are required' });
    }

    try {
        const msgId = crypto.randomUUID();
        const newMessage = {
            id: msgId,
            conversationId: id,
            senderId: req.user.id,
            encryptedContent,
            iv,
            keyHash: keyHash || null,
            createdAt: new Date().toISOString(),
            editedAt: null,
            deletedAt: null
        };

        await db.createMessage(newMessage);
        res.status(201).json(newMessage);
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/messages/:messageId/edit
app.post('/api/messages/:messageId/edit', requireAuth, async (req, res) => {
    const { messageId } = req.params;
    const { encryptedContent } = req.body;

    if (!encryptedContent) {
        return res.status(400).json({ error: 'encryptedContent required' });
    }

    try {
        const msg = await db.getMessageById(messageId);
        if (!msg) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (msg.senderId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden: You can only edit your own messages' });
        }

        await db.editMessage(messageId, encryptedContent);
        res.json({ success: true });
    } catch (err) {
        console.error("Edit message error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/messages/:messageId/delete
app.post('/api/messages/:messageId/delete', requireAuth, async (req, res) => {
    const { messageId } = req.params;

    try {
        const msg = await db.getMessageById(messageId);
        if (!msg) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Determine if user is sender or group admin
        let allowed = msg.senderId === req.user.id;
        if (!allowed) {
            const members = await db.getConversationMembers(msg.conversationId);
            const userMember = members.find(m => m.userId === req.user.id);
            if (userMember && userMember.role === 'admin') {
                allowed = true;
            }
        }

        if (!allowed) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await db.deleteMessage(messageId);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -------------------------------------------------------------
// SECURE FILE STORAGE ENDPOINTS
// -------------------------------------------------------------

// POST /api/files/upload
app.post('/api/files/upload', requireAuth, upload.single('file'), async (req, res) => {
    const { conversationId, iv } = req.body;
    const file = req.file;

    if (!conversationId || !iv || !file) {
        return res.status(400).json({ error: 'conversationId, iv, and file are required' });
    }

    try {
        // Membership check
        const members = await db.getConversationMembers(conversationId);
        const isMember = members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const fileId = crypto.randomUUID();
        const ref = await storage.upload(fileId, file.buffer);

        const fileRecord = {
            id: fileId,
            uploaderId: req.user.id,
            conversationId,
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            encryptedStoragePath: ref,
            iv,
            createdAt: new Date().toISOString()
        };

        await db.createFile(fileRecord);
        res.status(201).json({ id: fileId, filename: file.originalname });
    } catch (err) {
        console.error("File upload error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/files/download/:id
app.get('/api/files/download/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const fileRecord = await db.getFileById(id);
        if (!fileRecord) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Membership check
        const members = await db.getConversationMembers(fileRecord.conversationId);
        const isMember = members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Forbidden: Unauthorized access to this conversation files' });
        }

        const buffer = await storage.download(fileRecord.encryptedStoragePath);
        res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
        res.setHeader('Content-Type', fileRecord.mimetype);
        res.setHeader('Content-Length', fileRecord.size);
        res.setHeader('X-File-IV', fileRecord.iv); // Expose IV for client-side decryption
        res.send(buffer);
    } catch (err) {
        console.error("File download error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -------------------------------------------------------------
// ADMIN CONSOLE ENDPOINTS
// -------------------------------------------------------------

// GET /api/admin/users
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await db.getUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/users/create
app.post('/api/admin/users/create', requireAuth, requireAdmin, async (req, res) => {
    const { username, displayName, password, role } = req.body;
    if (!username || !displayName || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        const normalized = username.toLowerCase().trim();
        const existing = await db.getUserByUsername(normalized);
        if (existing) {
            return res.status(400).json({ error: 'Username taken' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: crypto.randomUUID(),
            username: normalized,
            displayName: displayName.trim(),
            passwordHash,
            role,
            status: 'active'
        };

        await db.createUser(newUser);
        res.status(201).json({ id: newUser.id, username: newUser.username });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/users/:userId/suspend
app.post('/api/admin/users/:userId/suspend', requireAuth, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body; // 'active' or 'suspended'
    if (status !== 'active' && status !== 'suspended') {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot suspend yourself' });
        }
        await db.updateUserStatus(userId, status);
        if (status === 'suspended') {
            await db.revokeAllSessionsForUser(userId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/users/:userId/delete
app.post('/api/admin/users/:userId/delete', requireAuth, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        await db.deleteUser(userId);
        await db.revokeAllSessionsForUser(userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/invitations
app.get('/api/admin/invitations', requireAuth, requireAdmin, async (req, res) => {
    try {
        const invites = await db.getInvitations();
        res.json(invites);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/invitations/generate
app.post('/api/admin/invitations/generate', requireAuth, requireAdmin, async (req, res) => {
    try {
        const token = 'inv_' + crypto.randomBytes(12).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

        const newInvite = {
            id: crypto.randomUUID(),
            token,
            createdBy: req.user.id,
            expiresAt: expiresAt.toISOString(),
            usedAt: null,
            revokedAt: null
        };

        await db.createInvitation(newInvite);
        res.status(201).json(newInvite);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/invitations/:inviteId/revoke
app.post('/api/admin/invitations/:inviteId/revoke', requireAuth, requireAdmin, async (req, res) => {
    const { inviteId } = req.params;
    try {
        await db.revokeInvitation(inviteId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/sessions
app.get('/api/admin/sessions', requireAuth, requireAdmin, async (req, res) => {
    try {
        const sessions = await db.getActiveSessions();
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/sessions/:sessionId/revoke
app.post('/api/admin/sessions/:sessionId/revoke', requireAuth, requireAdmin, async (req, res) => {
    const { sessionId } = req.params;
    try {
        await db.revokeSession(sessionId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/logs
app.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const logs = await db.getAuditLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/storage
app.get('/api/admin/storage', requireAuth, requireAdmin, async (req, res) => {
    try {
        const files = await db.getFiles();
        let totalSize = files.reduce((sum, f) => sum + f.size, 0);
        res.json({
            files,
            totalSize,
            count: files.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -------------------------------------------------------------
// STATIC FILES & HOME ROUTING
// -------------------------------------------------------------

// Serve static dashboard files for /private route
app.use('/private', requireAuth, express.static(path.join(__dirname, 'public', 'private')));

// Serve main portfolio assets
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve portfolio index.html (supports client redirects)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------
// SERVER LIFECYCLE & SEEDING
// -------------------------------------------------------------

async function startServer() {
    // Initialize Database
    await db.init();

    // Check if database is empty and seed admin account
    const users = await db.getUsers();
    if (users.length === 0) {
        const adminId = crypto.randomUUID();
        const adminPasswordHash = await bcrypt.hash('AdminPassword123', 10);
        const defaultAdmin = {
            id: adminId,
            username: 'admin',
            displayName: 'Administrator',
            passwordHash: adminPasswordHash,
            role: 'admin',
            status: 'active'
        };
        await db.createUser(defaultAdmin);
        console.log("=========================================");
        console.log("DATABASE IS EMPTY. SEEDED DEFAULT ADMIN:");
        console.log("Username: admin");
        console.log("Password: AdminPassword123");
        console.log("=========================================");
    }

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();
