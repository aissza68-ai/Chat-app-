/* ==========================================================================
   KODE LENGKAP JAVASCRIPT CHAT & MANAJEMEN PESAN (FULL TANPA PEMANGKASAN)
   ========================================================================== */

// 1. State Aplikasi (Penyimpanan Data Lokal Sifatnya Sementara)
const chatState = {
    currentUser: {
        id: "user_123", // Contoh ID user yang sedang login
        name: "Saya"
    },
    replyingTo: null,
    messages: [
        // Contoh data dummy awal pesan (bisa diganti dari database/websocket server Anda)
        { id: "msg_1", senderId: "user_456", senderName: "Budi", text: "Halo, apa kabar?", time: "10:00", isDeleted: false },
        { id: "msg_2", senderId: "user_123", senderName: "Saya", text: "Baik Budi, ada yang bisa dibantu?", time: "10:01", isDeleted: false }
    ]
};

// 2. Fungsi Utama: Render Daftar Pesan ke Kontainer Chat
function renderMessages(messagesArray) {
    const container = document.getElementById('messages-container');
    if (!container) {
        console.warn("Elemen #messages-container tidak ditemukan di DOM.");
        return;
    }
    
    // Bersihkan kontainer sebelum merender ulang
    container.innerHTML = '';

    messagesArray.forEach((msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        // Tentukan apakah pesan milik user yang sedang login (self) atau orang lain (other)
        const isSelf = msg.senderId === chatState.currentUser.id;
        messageDiv.classList.add(isSelf ? 'self' : 'other');

        // Cek apakah status pesan sudah dihapus
        const isDeleted = msg.isDeleted || msg.text === "Pesan ini telah dihapus";

        if (isDeleted) {
            // Jika pesan sudah dihapus, tampilkan teks khusus dan pastikan TIDAK ADA event swipe/reply
            messageDiv.classList.add('deleted-message');
            messageDiv.innerHTML = `
                <div class="msg-content" style="font-style: italic; opacity: 0.7; color: inherit;">
                    Pesan ini telah dihapus
                </div>
            `;
            // PENTING: Kita sengaja tidak memanggil fungsi attachSwipeListener di sini
        } else {
            // Jika pesan normal/aktif, render isi pesan secara lengkap
            messageDiv.innerHTML = `
                <span class="msg-sender">${escapeHtml(msg.senderName || 'User')}</span>
                <div class="msg-text">${escapeHtml(msg.text)}</div>
                <div class="msg-footer">
                    <span class="msg-time">${escapeHtml(msg.time || '')}</span>
                </div>
            `;

            // PASANG EVENT SWIPE HANYA PADA PESAN YANG BELUM DIHAPUS
            attachSwipeListener(messageDiv, msg);
            
            // Tambahan opsional: Klik pesan untuk memunculkan opsi hapus pesan
            messageDiv.addEventListener('click', () => {
                if (!msg.isDeleted) {
                    // Contoh fungsi pemanggil modal hapus pesan Anda
                    openDeleteConfirmationModal(msg.id);
                }
            });
        }

        container.appendChild(messageDiv);
    });

    // Auto-scroll otomatis ke pesan paling bawah (terbaru)
    container.scrollTop = container.scrollHeight;
}

// 3. Fungsi Gestur Swipe (Geser ke Kanan untuk Membalas / Reply)
function attachSwipeListener(element, messageData) {
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    element.addEventListener('touchstart', (e) => {
        // Pengecekan pengaman mutlak: Jika pesan sudah dihapus, abaikan sentuhan swipe!
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

        // Berikan efek geser visual ringan ke kanan saat jari digeser (maksimal 100px)
        if (diffX > 0 && diffX < 100) {
            element.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        
        let diffX = currentX - startX;
        
        // Kembalikan posisi elemen pesan secara halus ke tempat semula
        element.style.transform = 'translateX(0px)';

        // Jika digeser ke kanan sejauh lebih dari 60px, trigger pratinjau balasan
        if (diffX > 60) {
            // Pengecekan ulang keamanan status hapus sebelum memicu pratinjau reply
            if (!messageData.isDeleted && messageData.text !== "Pesan ini telah dihapus") {
                triggerReplyPreview(messageData);
            }
        }
        
        startX = 0;
        currentX = 0;
    });
}

// 4. Fungsi Menampilkan Kotak Pratinjau Balasan (Reply Preview Box) di Atas Input
function triggerReplyPreview(messageData) {
    chatState.replyingTo = messageData;
    
    // Cari elemen penampung pratinjau, buat baru jika belum ada di DOM
    let replyBox = document.getElementById('reply-preview-container');
    if (!replyBox) {
        replyBox = document.createElement('div');
        replyBox.id = 'reply-preview-container';
        replyBox.classList.add('reply-preview');
        
        const inputArea = document.querySelector('.chat-input-area');
        if (inputArea && inputArea.parentNode) {
            inputArea.parentNode.insertBefore(replyBox, inputArea);
        }
    }

    // Isi konten kotak pratinjau balasan
    replyBox.innerHTML = `
        <div style="overflow: hidden;">
            <strong style="color: #00c6ff; display: block; font-size: 12px;">Membalas ${escapeHtml(messageData.senderName)}:</strong>
            <div style="font-size: 11px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">
                ${escapeHtml(messageData.text)}
            </div>
        </div>
        <button type="button" onclick="cancelReply()" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer; padding: 0 5px;">&times;</button>
    `;
    replyBox.style.display = 'flex';
}

// 5. Fungsi Membatalkan Balasan (Close Reply Preview)
function cancelReply() {
    chatState.replyingTo = null;
    const replyBox = document.getElementById('reply-preview-container');
    if (replyBox) {
        replyBox.style.display = 'none';
        replyBox.innerHTML = '';
    }
}

// 6. Fungsi Eksekusi Penghapusan Pesan (Mengubah Status Menjadi "Pesan ini telah dihapus")
function deleteMessage(messageId) {
    const msgIndex = chatState.messages.findIndex(m => m.id === messageId);
    if (msgIndex !== -1) {
        // Ubah data pesan di state lokal menjadi status terhapus
        chatState.messages[msgIndex].isDeleted = true;
        chatState.messages[msgIndex].text = "Pesan ini telah dihapus";
        
        // Jika pesan yang sedang aktif dibalas (reply) ternyata dihapus, batalkan balasan tersebut
        if (chatState.replyingTo && chatState.replyingTo.id === messageId) {
            cancelReply();
        }
        
        // Render ulang daftar pesan agar tampilan langsung bersih dari teks lama dan terkunci dari swipe
        renderMessages(chatState.messages);
    }
}

// 7. Fungsi Simulasi Modal Konfirmasi Hapus Pesan (Opsional / Penyesuaian UI Anda)
function openDeleteConfirmationModal(messageId) {
    // Anda bisa mengintegrasikan fungsi ini dengan modal kustom aplikasi Anda
    const userConfirmed = confirm("Apakah Anda yakin ingin menghapus pesan ini?");
    if (userConfirmed) {
        deleteMessage(messageId);
    }
}

// 8. Fungsi Utilitas Keamanan: Mencegah XSS Injection pada Teks Chat
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- INISIALISASI AWAL SAAT SCRIPT DI-LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // Render pesan awal saat halaman pertama kali dibuka
    renderMessages(chatState.messages);
});
