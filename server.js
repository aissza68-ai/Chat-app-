const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

// Menambahkan CORS untuk mengizinkan koneksi dari Railway Edge Proxy
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8 // 100MB
});

// Memastikan folder uploads ada
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage Multer
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

// Database pengguna in-memory
const users = {};

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('check-user-id', (userId) => {
        const exists = Boolean(users[userId]);
        socket.emit('check-user-id-result', { exists });
    });

    socket.on('user-login', (data) => {
        const { userId, password, name } = data;

        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID dan Password tidak boleh kosong!' });
        }

        // Pendaftaran otomatis jika user belum ada
        if (!users[userId]) {
            users[userId] = {
                password: password,
                name: name ? name : 'User ' + userId
            };
        }

        // Verifikasi kata sandi
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

    socket.on('typing', (data) => socket.broadcast.emit('display-typing', data));
    socket.on('chat message', (msg) => io.emit('chat message', msg));
    socket.on('delete-message-everyone', (data) => io.emit('message-deleted-everyone', data));
});

// Port dinamis untuk Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server aktif pada port ${PORT}`);
});
