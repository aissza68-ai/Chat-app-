const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(express.static('public'));

app.post('/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Tidak ada file diunggah' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
    const isAudio = ['.webm', '.mp3', '.wav', '.ogg', '.m4a'].includes(ext);

    if (isVideo) {
        const compressedFilename = 'compressed-' + Date.now() + '.mp4';
        const outputPath = path.join(uploadDir, compressedFilename);

        const command = `ffmpeg -i "${filePath}" -vcodec libx264 -crf 28 -preset ultrafast -acodec aac -b:a 128k "${outputPath}"`;

        exec(command, (error) => {
            fs.unlink(filePath, () => {});
            if (error) {
                return res.json({ success: true, url: `/uploads/${req.file.filename}`, type: 'video' });
            }
            res.json({ success: true, url: `/uploads/${compressedFilename}`, type: 'video' });
        });
    } else if (isAudio) {
        res.json({ success: true, url: `/uploads/${req.file.filename}`, type: 'audio' });
    } else {
        res.json({ success: true, url: `/uploads/${req.file.filename}`, type: 'image' });
    }
});

// === FUNGSI SENSOR KATA KASAR ===
const badWords = [
    'kontol', 'memek', 'jembut', 'anjing', 'babi', 'kunyuk', 'puki', 
    'pukimak', 'pantek', 'asu', 'bangsat', 'ngentot', 'taik', 'tai', 
    'itil', 'goblok', 'tolol', 'lonte', 'bencong', 'banci', 'kintil'
];

function filterBadWords(text) {
    if (!text) return text;
    let filteredText = text;
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filteredText = filteredText.replace(regex, (match) => {
            if (match.length <= 2) return '*'.repeat(match.length);
            return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
        });
    });
    return filteredText;
}

const users = {};
const registeredUsers = {};
let messageHistory = [];

io.on('connection', (socket) => {
    socket.on('check-id', (userId, callback) => {
        if (registeredUsers[userId]) {
            callback({ exists: true, name: registeredUsers[userId].name });
        } else {
            callback({ exists: false });
        }
    });

    socket.on('login-account', ({ userId, password, name }, callback) => {
        if (registeredUsers[userId]) {
            if (registeredUsers[userId].password === password) {
                users[socket.id] = { userId, name: registeredUsers[userId].name };
                callback({ success: true, userId, name: registeredUsers[userId].name });
                broadcastUserList();
                socket.emit('load-history', messageHistory);
                io.emit('system-message', `${registeredUsers[userId].name} bergabung ke obrolan`);
            } else {
                callback({ success: false, message: 'Password salah!' });
            }
        } else {
            registeredUsers[userId] = { password, name };
            users[socket.id] = { userId, name };
            callback({ success: true, userId, name });
            broadcastUserList();
            socket.emit('load-history', messageHistory);
            io.emit('system-message', `${name} mendaftar & bergabung ke obrolan`);
        }
    });

    socket.on('chat-message', (data) => {
        const user = users[socket.id];
        if (!user) return;

        // Terapkan sensor pada teks pesan
        const cleanText = filterBadWords(data.text || '');

        const msgObj = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            senderId: user.userId,
            sender: user.name,
            text: cleanText,
            image: data.image || null,
            video: data.video || null,
            audio: data.audio || null,
            replyTo: data.replyTo || null,
            isDeleted: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        messageHistory.push(msgObj);
        if (messageHistory.length > 100) messageHistory.shift();

        io.emit('chat-message', msgObj);
    });

    socket.on('delete-message', (msgId) => {
        const msg = messageHistory.find(m => m.id === msgId);
        if (msg) {
            msg.isDeleted = true;
            msg.text = '';
            msg.image = null;
            msg.video = null;
            msg.audio = null;
            io.emit('message-deleted', msgId);
        }
    });

    socket.on('typing', (isTyping) => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.emit('user-typing', { username: user.name, isTyping });
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.emit('system-message', `${user.name} meninggalkan obrolan`);
            delete users[socket.id];
            broadcastUserList();
        }
    });

    function broadcastUserList() {
        const activeUsers = Object.values(users);
        const uniqueUsers = Array.from(new Set(activeUsers.map(a => a.userId)))
            .map(id => activeUsers.find(a => a.userId === id));

        io.emit('online-count', uniqueUsers.length);
        io.emit('online-users-list', uniqueUsers);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
