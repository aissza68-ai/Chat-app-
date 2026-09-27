/* ==========================================================================
   FULL SCRIPT.JS - LENGKAP SEUTUHNYA (LOGIN, SOCKET, CHAT, MEDIA, & SWIPE)
   ========================================================================== */

const socket = io();

let currentUser = null;
let replyingToMessage = null;
let selectedMessageIdForDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Form Login Sesuai HTML Lu
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const userId = document.getElementById('input-user-id').value.trim();
            const password = document.getElementById('input-password').value.trim();
            const userName = document.getElementById('input-name').value.trim();

            if (!userId || !password) {
                alert("ID Pengguna dan Password harus diisi!");
                return;
            }

            currentUser = {
                id: userId,
                name: userName || userId
            };

            // Kirim event login ke server via Socket.IO
            socket.emit('user_login', { userId, password, name: currentUser.name });

            // Sembunyikan layar login, tampilkan layar chat
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('chat-screen').style.display = 'flex';

            // Set nama dan ID di header chat
            document.getElementById('header-user-name').textContent = currentUser.name;
            document.getElementById('header-user-id').textContent = "ID: " + currentUser.id;
        });
    }

    // 2. Tombol Kirim Pesan & Enter
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input');

    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // 3. Tombol Fitur Media (Foto, Video, VN)
    const imageBtn = document.getElementById('image-btn');
    const imageInput = document.getElementById('image-input');
    if (imageBtn && imageInput) {
        imageBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleMediaUpload(file, 'image');
        });
    }

    const videoBtn = document.getElementById('video-btn');
    const videoInput = document.getElementById('video-input');
    if (videoBtn && videoInput) {
        videoBtn.addEventListener('click', () => videoInput.click());
        videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleMediaUpload(file, 'video');
        });
    }

    const vnBtn = document.getElementById('vn-btn');
    if (vnBtn) {
        vnBtn.addEventListener('click', () => {
            const recordingBox = document.getElementById('recording-box');
            if (recordingBox) {
                recordingBox.style.display = recordingBox.style.display === 'none' ? 'flex' : 'none';
            }
        });
    }

    // Tombol pembatalan recording VN
    document.getElementById('cancel-rec-btn')?.addEventListener('click', () => {
        const recordingBox = document.getElementById('recording-box');
        if (recordingBox) recordingBox.style.display = 'none';
    });

    // 4. Tombol Batal Pratinjau Balasan (Reply)
    const cancelReplyBtn = document.getElementById('cancel-reply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            replyingToMessage = null;
            const replyPreview = document.getElementById('reply-preview');
            if (replyPreview) replyPreview.style.display = 'none';
        });
    }

    // 5. Modal Hapus Pesan (Delete Modal)
    document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);
    
    document.getElementById('btn-delete-forme')?.addEventListener('click', () => {
        if (selectedMessageIdForDelete) {
            socket.emit('delete_message', { messageId: selectedMessageIdForDelete, type: 'me' });
            closeDeleteModal();
        }
    });

    document.getElementById('btn-delete-foreveryone')?.addEventListener('click', () => {
        if (selectedMessageIdForDelete) {
            socket.emit('delete_message', { messageId: selectedMessageIdForDelete, type: 'everyone' });
            closeDeleteModal();
        }
    });
});

// Fungsi Mengirim Pesan Teks
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;

    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        id: 'msg_' + Date.now(),
        senderId: currentUser ? currentUser.id : 'unknown',
        senderName: currentUser ? currentUser.name : 'User',
        text: text,
        type: 'text',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        replyTo: replyingToMessage ? replyingToMessage.id : null,
        isDeleted: false
    };

    socket.emit('send_message', messageData);

    messageInput.value = '';
    replyingToMessage = null;
    const replyPreview = document.getElementById('reply-preview');
    if (replyPreview) replyPreview.style.display = 'none';
}

// Fungsi Menangani Upload Media (Foto/Video)
function handleMediaUpload(file, type) {
    const uploadOverlay = document.getElementById('upload-overlay');
    if (uploadOverlay) uploadOverlay.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = function(e) {
        const mediaData = {
            id: 'msg_' + Date.now(),
            senderId: currentUser ? currentUser.id : 'unknown',
            senderName: currentUser ? currentUser.name : 'User',
            text: e.target.result,
            type: type,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            replyTo: replyingToMessage ? replyingToMessage.id : null,
            isDeleted: false
        };

        socket.emit('send_message', mediaData);

        if (uploadOverlay) uploadOverlay.style.display = 'none';
        replyingToMessage = null;
        const replyPreview = document.getElementById('reply-preview');
        if (replyPreview) replyPreview.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Socket.IO Menerima Pesan dari Server
socket.on('receive_message', (messagesArray) => {
    renderMessages(messagesArray);
});

socket.on('update_messages', (messagesArray) => {
    renderMessages(messagesArray);
});

// FUNGSI UTAMA RENDER PESAN & PENGAMANAN SWIPE PESAN TERHAPUS
function renderMessages(messagesArray) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    container.innerHTML = '';

    messagesArray.forEach((msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        const isSelf = currentUser && msg.senderId === currentUser.id;
        messageDiv.classList.add(isSelf ? 'self' : 'other');

        // Pengecekan mutlak status pesan terhapus
        const isDeleted = msg.isDeleted || msg.text === "Pesan ini telah dihapus";

        if (isDeleted) {
            messageDiv.classList.add('deleted-message');
            messageDiv.innerHTML = `
                <div class="msg-content" style="font-style: italic; opacity: 0.7;">
                    Pesan ini telah dihapus
                </div>
            `;
            // CATATAN MUTLAK: Pesan yang sudah dihapus SENGAJA TIDAK DIBERI event swipe sama sekali!
        } else {
            let contentHtml = '';
            if (msg.type === 'image') {
                contentHtml = `<img src="${msg.text}" style="max-width: 200px; border-radius: 8px; cursor: pointer;" onclick="openMediaPreview('${msg.text}', 'image')" />`;
            } else if (msg.type === 'video') {
                contentHtml = `<video src="${msg.text}" style="max-width: 200px; border-radius: 8px;" controls></video>`;
            } else {
                contentHtml = `<div class="msg-text">${escapeHtml(msg.text)}</div>`;
            }

            messageDiv.innerHTML = `
                <span class="msg-sender">${escapeHtml(msg.senderName || '')}</span>
                ${contentHtml}
                <div class="msg-footer">
                    <span class="msg-time">${escapeHtml(msg.time || '')}</span>
                </div>
            `;

            // Pasang event geser (swipe-to-reply) HANYA PADA PESAN YANG AKTIF
            attachSwipeListener(messageDiv, msg);

            // Event klik untuk membuka modal opsi hapus pesan
            messageDiv.addEventListener('click', () => {
                if (!msg.isDeleted) {
                    openDeleteModal(msg.id, isSelf);
                }
            });
        }

        container.appendChild(messageDiv);
    });

    container.scrollTop = container.scrollHeight;
}

// Fungsi Gestur Geser (Swipe) untuk Balas Pesan dengan Validasi Ketat
function attachSwipeListener(element, messageData) {
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    element.addEventListener('touchstart', (e) => {
        if (messageData.isDeleted || messageData.text === "Pesan ini telah dihapus") {
            return;
        }
        startX = e.touches[0].clientX;
        isSwiping = true;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX;
        let diffX = currentX - startX;

        if (diffX > 0 && diffX < 100) {
            element.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        
        let diffX = currentX - startX;
        element.style.transform = 'translateX(0px)';

        if (diffX > 60) {
            if (!messageData.isDeleted && messageData.text !== "Pesan ini telah dihapus") {
                replyingToMessage = messageData;
                
                const replyName = document.getElementById('reply-name');
                const replyText = document.getElementById('reply-text');
                const replyPreview = document.getElementById('reply-preview');

                if (replyName) replyName.textContent = messageData.senderName;
                if (replyText) replyText.textContent = messageData.type === 'image' ? '[Foto]' : (messageData.type === 'video' ? '[Video]' : messageData.text);
                if (replyPreview) replyPreview.style.display = 'flex';
            }
        }
        
        startX = 0;
        currentX = 0;
    });
}

// Fungsi Modal Hapus Pesan
function openDeleteModal(messageId, isSelf) {
    selectedMessageIdForDelete = messageId;
    const modal = document.getElementById('delete-modal');
    const btnEveryone = document.getElementById('btn-delete-foreveryone');
    
    if (modal) {
        modal.style.display = 'flex';
        if (btnEveryone) {
            btnEveryone.style.display = isSelf ? 'block' : 'none';
        }
    }
}

function closeDeleteModal() {
    selectedMessageIdForDelete = null;
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fungsi Pratinjau Media (Gambar/Video Modal)
function openMediaPreview(src, type) {
    const modal = document.getElementById('media-preview-modal');
    const img = document.getElementById('preview-image');
    const video = document.getElementById('preview-video');
    
    if (modal) modal.style.display = 'flex';
    if (type === 'image' && img) {
        img.src = src;
        img.style.display = 'block';
        if (video) video.style.display = 'none';
    }
}

function closeMediaPreview() {
    const modal = document.getElementById('media-preview-modal');
    if (modal) modal.style.display = 'none';
}

// Fungsi Keamanan Mencegah XSS Injection
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
