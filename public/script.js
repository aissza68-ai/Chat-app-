// Contoh cuplikan penanganan login di server.js (Node.js / Express / Socket.io)

const fs = require('fs');
const path = require('path');

// File database sederhana (misal menggunakan JSON)
const DB_FILE = path.join(__dirname, 'users.json');

function readUsers() {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    // Cek apakah ID sudah terdaftar (untuk mengubah teks tombol jadi "Masuk" atau "Daftar Baru")
    socket.on('check-user-id', (userId) => {
        const users = readUsers();
        const user = users.find(u => u.userId === userId);
        socket.emit('check-user-id-result', { exists: !!user });
    });

    // Proses Login / Pendaftaran
    socket.on('user-login', (data) => {
        let { userId, password, name } = data;
        if (!userId || !password) {
            return socket.emit('login-response', { success: false, message: 'ID dan Password wajib diisi!' });
        }

        let users = readUsers();
        let user = users.find(u => u.userId === userId);

        if (user) {
            // User sudah ada, verifikasi password
            if (user.password === password) {
                socket.emit('login-response', { 
                    success: true, 
                    userId: user.userId, 
                    username: user.name || user.userId,
                    history: globalChatHistory || [] 
                });
            } else {
                socket.emit('login-response', { success: false, message: 'Password salah!' });
            }
        } else {
            // User belum ada, daftarkan baru secara otomatis
            const newName = name ? name : userId;
            const newUser = { userId, password, name: newName };
            users.push(newUser);
            saveUsers(users);

            socket.emit('login-response', { 
                success: true, 
                userId: newUser.userId, 
                username: newUser.name,
                history: globalChatHistory || [] 
            });
        }
    });
});
