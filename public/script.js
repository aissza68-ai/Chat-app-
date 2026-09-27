/* ==========================================================================
   FULL SCRIPT.JS - AMAN UNTUK CSS & SOCKET ASLI LU
   ========================================================================== */

// (Pertahankan semua variabel dan inisialisasi socket / login asli lu di sini jika ada)

// FUNGSI UTAMA RENDER PESAN (Pastikan fungsi render lama lu diganti dengan ini)
function renderMessages(messagesArray) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    container.innerHTML = '';

    messagesArray.forEach((msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        // Sesuaikan dengan variabel user aktif di project lu (misal currentUser)
        const isSelf = typeof currentUser !== 'undefined' && currentUser && msg.senderId === currentUser.id;
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
            messageDiv.innerHTML = `
                <span class="msg-sender">${escapeHtml(msg.senderName || '')}</span>
                <div class="msg-text">${escapeHtml(msg.text)}</div>
                <div class="msg-footer">
                    <span class="msg-time">${escapeHtml(msg.time || '')}</span>
                </div>
            `;

            // Pasang event geser (swipe-to-reply) HANYA PADA PESAN YANG AKTIF/BELUM DIHAPUS
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
        // Validasi pengaman mutlak: Jika pesan sudah dihapus, batalkan proses swipe seketika!
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
            // Validasi akhir sebelum memicu pratinjau balasan
            if (!messageData.isDeleted && messageData.text !== "Pesan ini telah dihapus") {
                // Panggil fungsi reply bawaan project lu yang asli
                if (typeof showReplyPreview === 'function') {
                    showReplyPreview(messageData);
                } else if (typeof triggerReplyPreview === 'function') {
                    triggerReplyPreview(messageData);
                }
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
