const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Buat folder uploads jika belum ada
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.json({ success: false });
    res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

// Database Sementara & Active Users Map
const usersDb = {}; // { userId: { password, username } }
const activeUsers = new Map(); // socket.id -> { userId, username }
const chatHistory = [];

function broadcastOnlineUsers() {
    const onlineList = Array.from(activeUsers.values());
    io.emit('update-online-users', onlineList);
}

io.on('connection', (socket) => {

    socket.on('check-user-id', (userId) => {
        socket.emit('check-user-id-result', { exists: !!usersDb[userId] });
    });

    socket.on('user-login', ({ userId, password, name }) => {
        if (usersDb[userId]) {
            if (usersDb[userId].password !== password) {
                return socket.emit('login-response', { success: false, message: 'Password salah!' });
            }
        } else {
            usersDb[userId] = { password, username: name || `User ${userId}` };
        }

        const username = usersDb[userId].username;
        activeUsers.set(socket.id, { userId, username });

        socket.emit('login-response', {
            success: true,
            userId,
            username,
            history: chatHistory
        });

        broadcastOnlineUsers();
    });

    socket.on('chat message', (msg) => {
        chatHistory.push(msg);
        socket.broadcast.emit('chat message', msg);
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('display-typing', data);
    });

    socket.on('delete-message-everyone', (data) => {
        const msg = chatHistory.find(m => m.id === data.msgId);
        if (msg) msg.deleted = true;
        io.emit('message-deleted-everyone', data);
    });

    socket.on('disconnect', () => {
        activeUsers.delete(socket.id);
        broadcastOnlineUsers();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
