// ==========================================
// FULL SCRIPT.JS - SESUAI STRUKTUR HTML ANDA
// ==========================================

let currentUser = null;
let replyingToMessage = null;

document.addEventListener('DOMContentLoaded', () => {
    // Menangani proses submit form login sesuai HTML Anda
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const userId = document.getElementById('input-user-id').value.trim();
            const userName = document.getElementById('input-name').value.trim();

            if (!userId) {
                alert("ID Pengguna harus diisi!");
                return;
            }

            currentUser = {
                id: userId,
                name: userName || userId
            };

            // Sembunyikan layar login, tampilkan layar chat
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('chat-screen').style.display = 'flex';

            // Set nama di header chat
            document.getElementById('header-user-name').textContent = currentUser.name;
            document.getElementById('header-user-id').textContent = "ID: " + currentUser.id;
        });
    }

    // Tombol pembatalan reply
    const cancelReplyBtn = document.getElementById('cancel-reply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            replyingToMessage = null;
            document.getElementById('reply-preview').style.display = 'none';
        });
    }
});

// Fungsi Render Pesan (Menggunakan ID #messages yang sesuai dengan HTML Anda)
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
            // CATATAN: Pesan yang sudah dihapus SENGAJA TIDAK DIBERI event swipe sama sekali!
        } else {
            messageDiv.innerHTML = `
                <span class="msg-sender">${escapeHtml(msg.senderName || '')}</span>
                <div class="msg-text">${escapeHtml(msg.text)}</div>
                <div class="msg-footer">
                    <span class="msg-time">${escapeHtml(msg.time || '')}</span>
                </div>
            `;

            // Pasang event geser (swipe-to-reply) HANYA PADA PESAN YANG AKTIF
            attachSwipeListener(messageDiv, msg);
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
        // Validasi keamanan: Tolak sentuhan swipe jika pesan sudah dihapus
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

        // Berikan efek geser visual ringan ke kanan (maksimal 100px)
        if (diffX > 0 && diffX < 100) {
            element.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        
        let diffX = currentX - startX;
        element.style.transform = 'translateX(0px)';

        // Jika digeser ke kanan sejauh lebih dari 60px
        if (diffX > 60) {
            if (!messageData.isDeleted && messageData.text !== "Pesan ini telah dihapus") {
                replyingToMessage = messageData;
                
                // Tampilkan preview reply sesuai elemen HTML Anda
                document.getElementById('reply-name').textContent = messageData.senderName;
                document.getElementById('reply-text').textContent = messageData.text;
                document.getElementById('reply-preview').style.display = 'flex';
            }
        }
        
        startX = 0;
        currentX = 0;
    });
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
