const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100MB
});

// Inisialisasi Database SQLite
const dbFile = path.join(__dirname, 'chat_data.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
    // Tabel User
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        password TEXT,
        name TEXT
    )`);

    // Tabel Pesan
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT,
        text TEXT,
        fileUrl TEXT,
        sender TEXT,
        userId TEXT,
        replyTo TEXT,
        timestamp TEXT,
        deleted INTEGER DEFAULT 0
    )`);
});

// Folder Upload
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, 'file-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
    }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

// Hitung User Online
let onlineUsersCount = 0;

io.on('connection', (socket) => {
    onlineUsersCount++;
    io.emit('update-online-count', onlineUsersCount);

    // Cek ketersediaan User ID di DB
    socket.on('check-user-id', (userId) => {
        db.get("SELECT userId FROM users WHERE userId = ?", [userId], (err, row) => {
            socket.emit('check-user-id-result', { exists: !!row });
        });
    });

    // Login / Register dengan DB
    socket.on('user-login', (data) => {
        const { userId, password, name } = data;
        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID & Password wajib!' });
        }

        db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
            if (!row) {
                // User belum ada -> Daftar Baru
                const username = name || ('User ' + userId);
                db.run("INSERT INTO users (userId, password, name) VALUES (?, ?, ?)", [userId, password, username], (err) => {
                    if (err) return socket.emit('login-response', { success: false, message: 'Gagal pendaftaran!' });
                    
                    // Ambil pesan lama
                    db.all("SELECT * FROM messages ORDER BY ROWID ASC", [], (err, rows) => {
                        const history = (rows || []).map(r => ({
                            ...r,
                            replyTo: r.replyTo ? JSON.parse(r.replyTo) : null
                        }));
                        socket.emit('login-response', { success: true, userId, username, history });
                    });
                });
            } else if (row.password === password) {
                // Password Cocok -> Masuk
                db.all("SELECT * FROM messages ORDER BY ROWID ASC", [], (err, rows) => {
                    const history = (rows || []).map(r => ({
                        ...r,
                        replyTo: r.replyTo ? JSON.parse(r.replyTo) : null
                    }));
                    socket.emit('login-response', { success: true, userId, username: row.name, history });
                });
            } else {
                socket.emit('login-response', { success: false, message: 'Password salah!' });
            }
        });
    });

    // Kirim & Simpan Pesan ke DB
    socket.on('chat message', (msg) => {
        const replyStr = msg.replyTo ? JSON.stringify(msg.replyTo) : null;
        db.run(
            `INSERT INTO messages (id, type, text, fileUrl, sender, userId, replyTo, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [msg.id, msg.type, msg.text || '', msg.fileUrl || '', msg.sender, msg.userId, replyStr, msg.timestamp],
            (err) => {
                if (!err) io.emit('chat message', msg);
            }
        );
    });

    // Ketik
    socket.on('typing', (data) => socket.broadcast.emit('display-typing', data));

    // Hapus Pesan Semua Orang
    socket.on('delete-message-everyone', (data) => {
        db.run("UPDATE messages SET deleted = 1 WHERE id = ?", [data.msgId], () => {
            io.emit('message-deleted-everyone', data);
        });
    });

    // User Terputus
    socket.on('disconnect', () => {
        onlineUsersCount = Math.max(0, onlineUsersCount - 1);
        io.emit('update-online-count', onlineUsersCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server jalan di port ${PORT}`));
        
