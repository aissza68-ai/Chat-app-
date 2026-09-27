const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100MB limit
});

// Memastikan folder 'public/uploads' ada
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer untuk Upload Media (Foto, Video, VN)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, 'file-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
    }
});
const upload = multer({ storage: storage });

// Memahami body JSON & URL Encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve folder statis
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Route Upload File
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, fileUrl: fileUrl, filename: req.file.filename });
});

// Database sementara simpan pengguna (in-memory)
const users = {};

// Socket.io Logika Chat & Realtime
io.on('connection', (socket) => {

    // Cek apakah User ID sudah terdaftar
    socket.on('check-user-id', (userId) => {
        const exists = Boolean(users[userId]);
        socket.emit('check-user-id-result', { exists });
    });

    // Login atau Register
    socket.on('user-login', (data) => {
        const { userId, password, name } = data;

        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID dan Password wajib diisi!' });
        }

        // Jika user belum ada, daftarkan
        if (!users[userId]) {
            users[userId] = {
                password: password,
                name: name || ('User ' + userId)
            };
        }

        // Verifikasi password
        if (users[userId].password === password) {
            socket.emit('login-response', {
                success: true,
                userId: userId,
                username: users[userId].name
            });
        } else {
            socket.emit('login-response', {
                success: false,
                message: 'Password salah!'
            });
        }
    });

    // Mengetik (Typing)
    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    // Kirim Pesan Chat
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Hapus Pesan untuk Semua Orang
    socket.on('delete-message-everyone', (data) => {
        io.emit('message-deleted-everyone', data);
    });
});

// Port Dinamis Sesuai Lingkungan Railway (WAJIB process.env.PORT)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
});
