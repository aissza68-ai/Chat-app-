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
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e8
});

const dbUsers = Datastore.create({ filename: path.join(__dirname, 'users.db'), autoload: true });
const dbMessages = Datastore.create({ filename: path.join(__dirname, 'messages.db'), autoload: true });

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
    if (!req.file) return res.status(400).json({ success: false, message: 'Upload gagal' });
    res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

let activeSockets = new Set();

io.on('connection', (socket) => {
    activeSockets.add(socket.id);
    io.emit('update-online-count', activeSockets.size);

    socket.on('check-user-id', async (userId) => {
        try {
            const user = await dbUsers.findOne({ userId });
            socket.emit('check-user-id-result', { exists: !!user });
        } catch (err) {
            socket.emit('check-user-id-result', { exists: false });
        }
    });

    socket.on('user-login', async (data) => {
        const { userId, password, name } = data;
        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID dan Password wajib diisi!' });
        }

        try {
            let user = await dbUsers.findOne({ userId });

            if (!user) {
                const username = name || ('User ' + userId);
                user = { userId, password, name: username };
                await dbUsers.insert(user);
            } else if (user.password !== password) {
                return socket.emit('login-response', { success: false, message: 'Password salah!' });
            }

            const history = await dbMessages.find({}).sort({ createdAt: 1 });

            socket.emit('login-response', {
                success: true,
                userId: user.userId,
                username: user.name,
                history: history
            });
        } catch (err) {
            socket.emit('login-response', { success: false, message: 'Terjadi kesalahan server!' });
        }
    });

    socket.on('chat message', async (msg) => {
        try {
            msg.createdAt = Date.now();
            await dbMessages.insert(msg);
            socket.broadcast.emit('chat message', msg);
        } catch (err) {
            console.error('Gagal menyimpan pesan:', err);
        }
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    socket.on('delete-message-everyone', async (data) => {
        try {
            await dbMessages.update({ id: data.msgId }, { $set: { deleted: true } });
            io.emit('message-deleted-everyone', data);
        } catch (err) {
            console.error('Gagal menghapus pesan:', err);
        }
    });

    socket.on('disconnect', () => {
        activeSockets.delete(socket.id);
        io.emit('update-online-count', activeSockets.size);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server aktif pada port ${PORT}`);
});
