const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Datastore = require('nedb-promises');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // Limit 100MB
});

// Database Persisten NeDB (File lokal stabil tanpa butuh kompiler C++)
const dbUsers = Datastore.create({ filename: path.join(__dirname, 'users.db'), autoload: true });
const dbMessages = Datastore.create({ filename: path.join(__dirname, 'messages.db'), autoload: true });

// Pastikan Folder Upload Ada
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer
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

// Route Upload File (VN / Gambar / Video)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

// Status Online Counter
let onlineCount = 0;

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('update-online-count', onlineCount);

    // Cek ketersediaan User ID
    socket.on('check-user-id', async (userId) => {
        try {
            const user = await dbUsers.findOne({ userId });
            socket.emit('check-user-id-result', { exists: !!user });
        } catch (err) {
            socket.emit('check-user-id-result', { exists: false });
        }
    });

    // Login & Auto Register
    socket.on('user-login', async (data) => {
        const { userId, password, name } = data;
        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID dan Password wajib diisi!' });
        }

        try {
            let user = await dbUsers.findOne({ userId });

            if (!user) {
                // Pendaftaran Akun Baru
                const username = name || ('User ' + userId);
                user = { userId, password, name: username };
                await dbUsers.insert(user);
            } else if (user.password !== password) {
                return socket.emit('login-response', { success: false, message: 'Password salah!' });
            }

            // Ambil Seluruh Riwayat Pesan
            const history = await dbMessages.find({}).sort({ createdAt: 1 });

            socket.emit('login-response', {
                success: true,
                userId: user.userId,
                username: user.name,
                history: history
            });
        } catch (err) {
            socket.emit('login-response', { success: false, message: 'Terjadi kesalahan sistem!' });
        }
    });

    // Kirim & Simpan Pesan
    socket.on('chat message', async (msg) => {
        try {
            msg.createdAt = Date.now();
            await dbMessages.insert(msg);
            io.emit('chat message', msg);
        } catch (err) {
            console.error('Gagal menyimpan pesan:', err);
        }
    });

    // Indikator Mengetik
    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    // Hapus Pesan untuk Semua Orang
    socket.on('delete-message-everyone', async (data) => {
        try {
            await dbMessages.update({ id: data.msgId }, { $set: { deleted: true } });
            io.emit('message-deleted-everyone', data);
        } catch (err) {
            console.error('Gagal menghapus pesan:', err);
        }
    });

    // User Disconnect
    socket.on('disconnect', () => {
        onlineCount = Math.max(0, onlineCount - 1);
        io.emit('update-online-count', onlineCount);
    });
});

// Port Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
});
