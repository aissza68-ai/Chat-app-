// Fungsi Kirim Pesan Pengguna
function sendMessage() {
    const inputField = document.getElementById("message-input");
    const messageText = inputField.value.trim();
    
    if (messageText === "") return;

    const messagesContainer = document.getElementById("messages-container");
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Buat elemen HTML untuk pesan keluar (outgoing)
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "outgoing");
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHTML(messageText)}</p>
            <span class="msg-time">${currentTime} <i class="fa-solid fa-check-double" style="color: #53bdeb;"></i></span>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    inputField.value = "";
    
    // Auto Scroll ke bawah dengan animasi halus
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Perbarui preview chat di sidebar
    document.getElementById("preview-msg").innerText = "Anda: " + messageText;
    document.getElementById("last-time").innerText = currentTime;

    // Simulasi Anggota Grup Lain Membalas Pesan Secara Otomatis
    triggerGroupAutoReply(messageText);
}

// Enter key trigger
function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

// Simulasi Anggota Grup Lain Mengetik & Membalas
function triggerGroupAutoReply(userMsg) {
    const typingIndicator = document.getElementById("typing-indicator");
    const messagesContainer = document.getElementById("messages-container");

    // Daftar nama anggota acak di grup
    const members = [
        { name: "Siti Developer", avatar: "https://i.pravatar.cc/150?img=44" },
        { name: "Andi Developer", avatar: "https://i.pravatar.cc/150?img=11" },
        { name: "Sinta UI", avatar: "https://i.pravatar.cc/150?img=25" }
    ];
    
    // Pilih anggota secara acak
    const randomMember = members[Math.floor(Math.random() * members.length)];
    
    // Ubah teks indikator dengan nama anggota yang sedang mengetik
    typingIndicator.querySelector("i").innerText = `${randomMember.name} sedang mengetik...`;

    // Tampilkan indikator mengetik setelah 1 detik
    setTimeout(() => {
        typingIndicator.style.display = "flex";
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 1000);

    // Hilangkan indikator dan tampilkan balasan setelah 3 detik
    setTimeout(() => {
        typingIndicator.style.display = "none";
        
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const replyDiv = document.createElement("div");
        replyDiv.classList.add("message", "incoming");
        
        // Respon dinamis sederhana berdasarkan teks user
        let replyText = "Setuju dengan itu! Keren banget pembahasannya.";
        if (userMsg.toLowerCase().includes("halo") || userMsg.toLowerCase().includes("hi")) {
            replyText = "Halo juga! Ada yang bisa dibantu terkait kodenya?";
        } else if (userMsg.toLowerCase().includes("fitur")) {
            replyText = "Fiturnya sudah lengkap banget ini, mantap!";
        }

        replyDiv.innerHTML = `
            <div class="message-content">
                <span class="sender-name">${randomMember.name}</span>
                <p>${replyText}</p>
                <span class="msg-time">${currentTime}</span>
            </div>
        `;

        messagesContainer.appendChild(replyDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Perbarui preview chat di sidebar
        document.getElementById("preview-msg").innerText = `${randomMember.name}: ${replyText}`;
        document.getElementById("last-time").innerText = currentTime;

    }, 3500);
}

// Fungsi Keamanan Sederhana untuk Mencegah XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function sendAttachment() {
    alert("Simulasi: Panel unggah foto/dokumen grup dibuka!");
}

function toggleGroupInfo() {
    alert("Informasi Grup: Grup Developer AI memiliki 5 anggota aktif.");
}
