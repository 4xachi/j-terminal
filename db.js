const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const JSON_DB_PATH = path.join(DATA_DIR, 'db.json');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'db.sqlite');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbType = 'sqlite';
let sqliteDb = null;
let jsonDbData = {
    users: [],
    invitations: [],
    sessions: [],
    conversations: [],
    conversation_members: [],
    messages: [],
    files: [],
    audit_logs: []
};

// JSON Database Helper Methods
function loadJsonDb() {
    try {
        if (fs.existsSync(JSON_DB_PATH)) {
            const data = fs.readFileSync(JSON_DB_PATH, 'utf8');
            jsonDbData = JSON.parse(data);
        } else {
            saveJsonDb();
        }
    } catch (err) {
        console.error("Failed to load JSON database:", err);
    }
}

function saveJsonDb() {
    try {
        const tmpPath = JSON_DB_PATH + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(jsonDbData, null, 2), 'utf8');
        fs.renameSync(tmpPath, JSON_DB_PATH);
    } catch (err) {
        console.error("Failed to save JSON database:", err);
    }
}

// Initialize database
function init() {
    return new Promise((resolve) => {
        try {
            const sqlite3 = require('sqlite3').verbose();
            sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
                if (err) {
                    console.warn("Could not connect to SQLite file, falling back to JSON db:", err.message);
                    useJsonFallback();
                    resolve();
                } else {
                    console.log("Connected to SQLite database.");
                    dbType = 'sqlite';
                    createSqliteTables().then(resolve).catch((err) => {
                        console.error("SQL table creation failed, falling back to JSON:", err);
                        useJsonFallback();
                        resolve();
                    });
                }
            });
        } catch (e) {
            console.warn("sqlite3 package not available, falling back to JSON file storage.");
            useJsonFallback();
            resolve();
        }
    });
}

function useJsonFallback() {
    dbType = 'json';
    loadJsonDb();
    // Create seed admin if empty
    if (jsonDbData.users.length === 0) {
        // We will seed an default admin account if empty. 
        // Note: Real admin setup will be done via claims or direct seeding.
    }
    console.log("Fallback JSON database initialized.");
}

function createSqliteTables() {
    return new Promise((resolve, reject) => {
        sqliteDb.serialize(() => {
            sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                displayName TEXT,
                passwordHash TEXT,
                role TEXT,
                status TEXT,
                createdAt TEXT,
                updatedAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS invitations (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE,
                createdBy TEXT,
                expiresAt TEXT,
                usedAt TEXT,
                revokedAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                userId TEXT,
                ipAddress TEXT,
                createdAt TEXT,
                lastActiveAt TEXT,
                revokedAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                name TEXT,
                type TEXT,
                createdBy TEXT,
                createdAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS conversation_members (
                conversationId TEXT,
                userId TEXT,
                role TEXT,
                joinedAt TEXT,
                PRIMARY KEY (conversationId, userId)
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversationId TEXT,
                senderId TEXT,
                encryptedContent TEXT,
                iv TEXT,
                keyHash TEXT,
                createdAt TEXT,
                editedAt TEXT,
                deletedAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                uploaderId TEXT,
                conversationId TEXT,
                filename TEXT,
                mimetype TEXT,
                size INTEGER,
                encryptedStoragePath TEXT,
                iv TEXT,
                createdAt TEXT
            )`);

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                userId TEXT,
                eventType TEXT,
                ipAddress TEXT,
                createdAt TEXT
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

// User Actions
function getUserByUsername(username) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const user = jsonDbData.users.find(u => u.username === username);
        return Promise.resolve(user || null);
    }
}

function getUserById(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const user = jsonDbData.users.find(u => u.id === id);
        return Promise.resolve(user || null);
    }
}

function createUser(user) {
    const now = new Date().toISOString();
    user.createdAt = now;
    user.updatedAt = now;
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO users (id, username, displayName, passwordHash, role, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.username, user.displayName, user.passwordHash, user.role, user.status, user.createdAt, user.updatedAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(user);
                }
            );
        });
    } else {
        jsonDbData.users.push(user);
        saveJsonDb();
        return Promise.resolve(user);
    }
}

function updateUserStatus(id, status) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `UPDATE users SET status = ?, updatedAt = ? WHERE id = ?`,
                [status, now, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    } else {
        const user = jsonDbData.users.find(u => u.id === id);
        if (user) {
            user.status = status;
            user.updatedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function updateUserProfile(id, username, displayName, passwordHash) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `UPDATE users SET username = ?, displayName = ?, passwordHash = ?, updatedAt = ? WHERE id = ?`,
                [username, displayName, passwordHash, now, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    } else {
        const user = jsonDbData.users.find(u => u.id === id);
        if (user) {
            user.username = username;
            user.displayName = displayName;
            user.passwordHash = passwordHash;
            user.updatedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function getUsers() {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT id, username, displayName, role, status, createdAt FROM users`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } else {
        return Promise.resolve(jsonDbData.users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt
        })));
    }
}

function deleteUser(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`DELETE FROM users WHERE id = ?`, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        jsonDbData.users = jsonDbData.users.filter(u => u.id !== id);
        saveJsonDb();
        return Promise.resolve();
    }
}

// Invitations Actions
function createInvitation(inv) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO invitations (id, token, createdBy, expiresAt, usedAt, revokedAt)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [inv.id, inv.token, inv.createdBy, inv.expiresAt, inv.usedAt, inv.revokedAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(inv);
                }
            );
        });
    } else {
        jsonDbData.invitations.push(inv);
        saveJsonDb();
        return Promise.resolve(inv);
    }
}

function getInvitationByToken(token) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM invitations WHERE token = ?`, [token], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const inv = jsonDbData.invitations.find(i => i.token === token);
        return Promise.resolve(inv || null);
    }
}

function useInvitation(token) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE invitations SET usedAt = ? WHERE token = ?`, [now, token], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        const inv = jsonDbData.invitations.find(i => i.token === token);
        if (inv) {
            inv.usedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function revokeInvitation(id) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE invitations SET revokedAt = ? WHERE id = ?`, [now, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        const inv = jsonDbData.invitations.find(i => i.id === id);
        if (inv) {
            inv.revokedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function getInvitations() {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM invitations`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } else {
        return Promise.resolve(jsonDbData.invitations);
    }
}

// Sessions Actions
function createSession(sess) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO sessions (id, userId, ipAddress, createdAt, lastActiveAt, revokedAt)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [sess.id, sess.userId, sess.ipAddress, sess.createdAt, sess.lastActiveAt, sess.revokedAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(sess);
                }
            );
        });
    } else {
        jsonDbData.sessions.push(sess);
        saveJsonDb();
        return Promise.resolve(sess);
    }
}

function getSessionById(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM sessions WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const sess = jsonDbData.sessions.find(s => s.id === id);
        return Promise.resolve(sess || null);
    }
}

function updateSessionActivity(id) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE sessions SET lastActiveAt = ? WHERE id = ?`, [now, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        const sess = jsonDbData.sessions.find(s => s.id === id);
        if (sess) {
            sess.lastActiveAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function getSessionsByUserId(userId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM sessions WHERE userId = ? AND revokedAt IS NULL`, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } else {
        return Promise.resolve(jsonDbData.sessions.filter(s => s.userId === userId && !s.revokedAt));
    }
}

function getActiveSessions() {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT s.*, u.username FROM sessions s JOIN users u ON s.userId = u.id WHERE s.revokedAt IS NULL`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    } else {
        const active = jsonDbData.sessions
            .filter(s => !s.revokedAt)
            .map(s => {
                const user = jsonDbData.users.find(u => u.id === s.userId);
                return { ...s, username: user ? user.username : 'unknown' };
            });
        return Promise.resolve(active);
    }
}

function revokeSession(id) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE sessions SET revokedAt = ? WHERE id = ?`, [now, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        const sess = jsonDbData.sessions.find(s => s.id === id);
        if (sess) {
            sess.revokedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function revokeAllSessionsForUser(userId) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE sessions SET revokedAt = ? WHERE userId = ?`, [now, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        jsonDbData.sessions.forEach(s => {
            if (s.userId === userId) s.revokedAt = now;
        });
        saveJsonDb();
        return Promise.resolve();
    }
}

// Conversations Actions
function createConversation(conv) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO conversations (id, name, type, createdBy, createdAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [conv.id, conv.name, conv.type, conv.createdBy, conv.createdAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(conv);
                }
            );
        });
    } else {
        jsonDbData.conversations.push(conv);
        saveJsonDb();
        return Promise.resolve(conv);
    }
}

function addConversationMember(member) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO conversation_members (conversationId, userId, role, joinedAt)
                 VALUES (?, ?, ?, ?)`,
                [member.conversationId, member.userId, member.role, member.joinedAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(member);
                }
            );
        });
    } else {
        jsonDbData.conversation_members.push(member);
        saveJsonDb();
        return Promise.resolve(member);
    }
}

function getConversationMembers(conversationId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT cm.*, u.username, u.displayName FROM conversation_members cm
                 JOIN users u ON cm.userId = u.id
                 WHERE cm.conversationId = ?`,
                [conversationId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    } else {
        const members = jsonDbData.conversation_members
            .filter(cm => cm.conversationId === conversationId)
            .map(cm => {
                const user = jsonDbData.users.find(u => u.id === cm.userId);
                return {
                    ...cm,
                    username: user ? user.username : 'unknown',
                    displayName: user ? user.displayName : 'Unknown'
                };
            });
        return Promise.resolve(members);
    }
}

function getUserConversations(userId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT c.* FROM conversations c
                 JOIN conversation_members cm ON c.id = cm.conversationId
                 WHERE cm.userId = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    } else {
        const cIds = jsonDbData.conversation_members
            .filter(cm => cm.userId === userId)
            .map(cm => cm.conversationId);
        const convs = jsonDbData.conversations.filter(c => cIds.includes(c.id));
        return Promise.resolve(convs);
    }
}

function getConversationById(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM conversations WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const conv = jsonDbData.conversations.find(c => c.id === id);
        return Promise.resolve(conv || null);
    }
}

function removeConversationMember(conversationId, userId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `DELETE FROM conversation_members WHERE conversationId = ? AND userId = ?`,
                [conversationId, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    } else {
        jsonDbData.conversation_members = jsonDbData.conversation_members.filter(
            cm => !(cm.conversationId === conversationId && cm.userId === userId)
        );
        saveJsonDb();
        return Promise.resolve();
    }
}

function deleteConversation(conversationId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.serialize(() => {
                sqliteDb.run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
                sqliteDb.run(`DELETE FROM conversation_members WHERE conversationId = ?`, [conversationId]);
                sqliteDb.run(`DELETE FROM messages WHERE conversationId = ?`, [conversationId]);
                sqliteDb.run(`DELETE FROM files WHERE conversationId = ?`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    } else {
        jsonDbData.conversations = jsonDbData.conversations.filter(c => c.id !== conversationId);
        jsonDbData.conversation_members = jsonDbData.conversation_members.filter(cm => cm.conversationId !== conversationId);
        jsonDbData.messages = jsonDbData.messages.filter(m => m.conversationId !== conversationId);
        jsonDbData.files = jsonDbData.files.filter(f => f.conversationId !== conversationId);
        saveJsonDb();
        return Promise.resolve();
    }
}

// Messages Actions
function createMessage(msg) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO messages (id, conversationId, senderId, encryptedContent, iv, keyHash, createdAt, editedAt, deletedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [msg.id, msg.conversationId, msg.senderId, msg.encryptedContent, msg.iv, msg.keyHash, msg.createdAt, msg.editedAt, msg.deletedAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(msg);
                }
            );
        });
    } else {
        jsonDbData.messages.push(msg);
        saveJsonDb();
        return Promise.resolve(msg);
    }
}

function getConversationMessages(conversationId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT m.*, u.username, u.displayName FROM messages m
                 JOIN users u ON m.senderId = u.id
                 WHERE m.conversationId = ?
                 ORDER BY m.createdAt ASC`,
                [conversationId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    } else {
        const msgs = jsonDbData.messages
            .filter(m => m.conversationId === conversationId)
            .map(m => {
                const user = jsonDbData.users.find(u => u.id === m.senderId);
                return {
                    ...m,
                    username: user ? user.username : 'unknown',
                    displayName: user ? user.displayName : 'Unknown'
                };
            })
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return Promise.resolve(msgs);
    }
}

function getMessageById(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM messages WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const msg = jsonDbData.messages.find(m => m.id === id);
        return Promise.resolve(msg || null);
    }
}

function editMessage(id, encryptedContent) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `UPDATE messages SET encryptedContent = ?, editedAt = ? WHERE id = ?`,
                [encryptedContent, now, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    } else {
        const msg = jsonDbData.messages.find(m => m.id === id);
        if (msg) {
            msg.encryptedContent = encryptedContent;
            msg.editedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

function deleteMessage(id) {
    const now = new Date().toISOString();
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `UPDATE messages SET deletedAt = ? WHERE id = ?`,
                [now, id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    } else {
        const msg = jsonDbData.messages.find(m => m.id === id);
        if (msg) {
            msg.deletedAt = now;
            saveJsonDb();
        }
        return Promise.resolve();
    }
}

// Files Actions
function createFile(file) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO files (id, uploaderId, conversationId, filename, mimetype, size, encryptedStoragePath, iv, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [file.id, file.uploaderId, file.conversationId, file.filename, file.mimetype, file.size, file.encryptedStoragePath, file.iv, file.createdAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(file);
                }
            );
        });
    } else {
        jsonDbData.files.push(file);
        saveJsonDb();
        return Promise.resolve(file);
    }
}

function getFileById(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT * FROM files WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    } else {
        const file = jsonDbData.files.find(f => f.id === id);
        return Promise.resolve(file || null);
    }
}

function getFiles() {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM files`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } else {
        return Promise.resolve(jsonDbData.files);
    }
}

function getFilesByConversationId(conversationId) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM files WHERE conversationId = ?`, [conversationId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    } else {
        const files = jsonDbData.files.filter(f => f.conversationId === conversationId);
        return Promise.resolve(files);
    }
}

function deleteFileRecord(id) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(`DELETE FROM files WHERE id = ?`, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } else {
        jsonDbData.files = jsonDbData.files.filter(f => f.id !== id);
        saveJsonDb();
        return Promise.resolve();
    }
}

// Audit Logs Actions
function createAuditLog(log) {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.run(
                `INSERT INTO audit_logs (id, userId, eventType, ipAddress, createdAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [log.id, log.userId, log.eventType, log.ipAddress, log.createdAt],
                (err) => {
                    if (err) reject(err);
                    else resolve(log);
                }
            );
        });
    } else {
        jsonDbData.audit_logs.push(log);
        saveJsonDb();
        return Promise.resolve(log);
    }
}

function getAuditLogs() {
    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            sqliteDb.all(
                `SELECT a.*, u.username FROM audit_logs a
                 LEFT JOIN users u ON a.userId = u.id
                 ORDER BY a.createdAt DESC LIMIT 200`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    } else {
        const logs = jsonDbData.audit_logs
            .map(a => {
                const user = jsonDbData.users.find(u => u.id === a.userId);
                return { ...a, username: user ? user.username : 'system/anonymous' };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 200);
        return Promise.resolve(logs);
    }
}

module.exports = {
    init,
    getUserByUsername,
    getUserById,
    createUser,
    updateUserStatus,
    getUsers,
    deleteUser,
    createInvitation,
    getInvitationByToken,
    useInvitation,
    revokeInvitation,
    getInvitations,
    createSession,
    getSessionById,
    updateSessionActivity,
    getSessionsByUserId,
    getActiveSessions,
    revokeSession,
    revokeAllSessionsForUser,
    createConversation,
    addConversationMember,
    getConversationMembers,
    getUserConversations,
    getConversationById,
    createMessage,
    getConversationMessages,
    getMessageById,
    editMessage,
    deleteMessage,
    createFile,
    getFileById,
    getFiles,
    deleteFileRecord,
    createAuditLog,
    getAuditLogs,
    updateUserProfile,
    removeConversationMember,
    deleteConversation,
    getFilesByConversationId
};
