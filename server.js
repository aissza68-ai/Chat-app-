// Jalankan server statis untuk folder public & uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Socket.io Connection
io.on('connection', (socket) => {

    // Cek ID Pengguna
    socket.on('check-user-id', (userId) => {
        // ganti dengan logika cek user di database/memory Anda
        const exists = users.hasOwnProperty(userId); 
        socket.emit('check-user-id-result', { exists });
    });

    // Login / Registrasi User
    socket.on('user-login', (data) => {
        const { userId, password, name } = data;
        
        // Contoh verifikasi/simpan sederhana:
        if (!users[userId]) {
            users[userId] = { password, name: name || 'User ' + userId };
        }

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

    // Kirim Pesan
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Hapus Pesan
    socket.on('delete-message-everyone', (data) => {
        io.emit('message-deleted-everyone', data);
    });
});
