const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

let currentUserId = '';
let currentUsername = '';
let selectedReplyMsg = null;
let typingTimeout = null;
let pendingDeleteMsgId = null;

let mediaRecorder = null;
let audioChunks = [];
let recTimerInterval = null;
let recSeconds = 0;

// Elemen UI
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const inputUserId = document.getElementById('input-user-id');
const inputPassword = document.getElementById('input-password');
const inputName = document.getElementById('input-name');
const nameGroup = document.getElementById('name-group');
const btnLogin = document.getElementById('btn-login');

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

const replyPreview = document.getElementById('reply-preview');
const replyName = document.getElementById('reply-name');
const replyText = document.getElementById('reply-text');
const cancelReplyBtn = document.getElementById('cancel-reply');

const deleteModal = document.getElementById('delete-modal');
const btnDeleteForMe = document.getElementById('btn-delete-forme');
const btnDeleteForEveryone = document.getElementById('btn-delete-foreveryone');
const btnCancelDelete = document.getElementById('btn-cancel-delete');

const vnBtn = document.getElementById('vn-btn');
const recordingBox = document.getElementById('recording-box');
const recTimer = document.getElementById('rec-timer');
const cancelRecBtn = document.getElementById('cancel-rec-btn');
const stopSendRecBtn = document.getElementById('stop-send-rec-btn');

const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
const videoBtn = document.getElementById('video-btn');
const videoInput = document.getElementById('video-input');

// -------------------------------------------------------------
// LOGIKA LOGIN & USER REGISTER
// -------------------------------------------------------------
inputUserId.addEventListener('input', () => {
    const val = inputUserId.value.trim();
    if (val.length === 4) {
        socket.emit('check-user-id', val);
    } else {
        nameGroup.style.display = 'none';
        btnLogin.innerText = 'Masuk / Daftar';
    }
});

socket.on('check-user-id-result', (res) => {
    if (res.exists) {
        nameGroup.style.display = 'none';
        btnLogin.innerText = 'Masuk';
    } else {
        nameGroup.style.display = 'block';
        btnLogin.innerText = 'Daftar Baru';
    }
});

btnLogin.addEventListener('click', () => {
    const userId = inputUserId.value.trim();
    const password = inputPassword.value.trim();
    const name = inputName.value.trim();

    if (!userId || userId.length !== 4) {
        return alert('ID Pengguna harus 4 digit!');
    }
    if (!password || password.length !== 6) {
        return alert('Password harus 6 digit!');
    }

    socket.emit('user-login', { userId, password, name });
});

socket.on('login-response', (res) => {
    if (res.success) {
        currentUserId = res.userId;
        currentUsername = res.username;
        loginScreen.style.display = 'none';
        chatScreen.style.display = 'flex';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        alert(res.message || 'Gagal masuk!');
    }
});

// -------------------------------------------------------------
// BALAS PESAN (REPLY)
// -------------------------------------------------------------
cancelReplyBtn.addEventListener('click', () => {
    selectedReplyMsg = null;
    replyPreview.style.display = 'none';
});

function setReplyMessage(msgData) {
    selectedReplyMsg = msgData;
    replyName.innerText = msgData.sender;
    replyText.innerText = msgData.type === 'text' ? msgData.text : `[${msgData.type.toUpperCase()}]`;
    replyPreview.style.display = 'flex';
    messageInput.focus();
}

// -------------------------------------------------------------
// LOGIKA KETIK (TYPING INDICATOR)
// -------------------------------------------------------------
messageInput.addEventListener('input', () => {
    socket.emit('typing', { username: currentUsername, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { username: currentUsername, isTyping: false });
    }, 2000);
});

socket.on('display-typing', (data) => {
    if (data.isTyping && data.username !== currentUsername) {
        typingIndicator.innerText = `${data.username} sedang mengetik...`;
        typingIndicator.style.display = 'block';
    } else {
        typingIndicator.style.display = 'none';
    }
});

// -------------------------------------------------------------
// KIRIM PESAN TEKS
// -------------------------------------------------------------
sendBtn.addEventListener('click', sendTextMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
});

function sendTextMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const msgData = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: 'text',
        text: text,
        sender: currentUsername,
        userId: currentUserId,
        replyTo: selectedReplyMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit('chat message', msgData);

    messageInput.value = '';
    selectedReplyMsg = null;
    replyPreview.style.display = 'none';
    socket.emit('typing', { username: currentUsername, isTyping: false });
}

// -------------------------------------------------------------
// LOGIKA VOICE NOTE (RECORDING)
// -------------------------------------------------------------
vnBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return alert('Perangkat/Browser Anda tidak mendukung perekaman suara.');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];

        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            options = { mimeType: 'audio/ogg' };
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start();
        recSeconds = 0;
        recTimer.innerText = '00:00';
        recordingBox.style.display = 'flex';

        recTimerInterval = setInterval(() => {
            recSeconds++;
            const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
            const s = String(recSeconds % 60).padStart(2, '0');
            recTimer.innerText = `${m}:${s}`;
        }, 1000);

    } catch (err) {
        alert('Izin mikrofon ditolak atau terjadi masalah!');
    }
});

cancelRecBtn.addEventListener('click', () => stopRecording(false));
stopSendRecBtn.addEventListener('click', () => stopRecording(true));

function stopRecording(send) {
    if (!mediaRecorder) return;

    clearInterval(recTimerInterval);
    recordingBox.style.display = 'none';

    mediaRecorder.onstop = () => {
        if (send && audioChunks.length > 0) {
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';

            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.${ext}`, { type: mimeType });
            uploadFileWithProgress(audioFile, 'audio');
        }
        audioChunks = [];
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorder = null;
    };

    mediaRecorder.stop();
}

// -------------------------------------------------------------
// UPLOAD MEDIA (IMAGE & VIDEO)
// -------------------------------------------------------------
imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFileWithProgress(file, 'image');
    imageInput.value = '';
});

videoBtn.addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFileWithProgress(file, 'video');
    videoInput.value = '';
});

function uploadFileWithProgress(file, type) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success || data.fileUrl || data.filename) {
            const fileUrl = data.fileUrl || `/uploads/${data.filename}`;
            const msgData = {
                id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                type: type,
                fileUrl: fileUrl,
                sender: currentUsername,
                userId: currentUserId,
                replyTo: selectedReplyMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            socket.emit('chat message', msgData);

            selectedReplyMsg = null;
            replyPreview.style.display = 'none';
        }
    })
    .catch(err => console.error('Upload gagal:', err));
}

// -------------------------------------------------------------
// MENAMPILKAN PESAN DI CHAT (RENDER)
// -------------------------------------------------------------
socket.on('chat message', (msg) => {
    renderMessage(msg);
});

function renderMessage(msg) {
    const existingMsg = document.getElementById(msg.id);
    if (existingMsg) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = msg.id;
    const isSelf = msg.userId === currentUserId;
    msgDiv.classList.add('message', isSelf ? 'self' : 'other');

    let replyHTML = '';
    if (msg.replyTo) {
        const replyContent = msg.replyTo.type === 'text' ? msg.replyTo.text : `[${msg.replyTo.type.toUpperCase()}]`;
        replyHTML = `
            <div class="reply-box">
                <small><strong>${msg.replyTo.sender}</strong></small>
                <p>${replyContent}</p>
            </div>
        `;
    }

    let contentHTML = '';
    if (msg.type === 'image') {
        contentHTML = `<img src="${msg.fileUrl}" style="max-width: 100%; border-radius: 8px;" />`;
    } else if (msg.type === 'video') {
        contentHTML = `<video src="${msg.fileUrl}" controls playsinline preload="metadata" style="max-width: 100%; border-radius: 8px;"></video>`;
    } else if (msg.type === 'audio') {
        contentHTML = `<audio src="${msg.fileUrl}" controls preload="metadata" style="width: 100%;"></audio>`;
    } else {
        contentHTML = `<p>${msg.text}</p>`;
    }

    const deleteBtnHTML = `<span class="delete-icon" onclick="openDeleteModal('${msg.id}', '${msg.userId}')">&times;</span>`;

    msgDiv.innerHTML = `
        ${deleteBtnHTML}
        <strong>${msg.sender}</strong>
        ${replyHTML}
        ${contentHTML}
        <div class="msg-footer">
            <small class="msg-time">${msg.timestamp || ''}</small>
            <button class="btn-reply-msg" onclick='triggerReply(${JSON.stringify(msg)})'>Balas</button>
        </div>
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

window.triggerReply = function(msg) {
    setReplyMessage(msg);
};

// -------------------------------------------------------------
// HAPUS PESAN (DELETE FOR ME / EVERYONE)
// -------------------------------------------------------------
window.openDeleteModal = function(msgId, msgUserId) {
    pendingDeleteMsgId = msgId;
    deleteModal.style.display = 'flex';

    if (msgUserId === currentUserId) {
        btnDeleteForEveryone.style.display = 'block';
    } else {
        btnDeleteForEveryone.style.display = 'none';
    }
};

btnCancelDelete.addEventListener('click', () => {
    pendingDeleteMsgId = null;
    deleteModal.style.display = 'none';
});

btnDeleteForMe.addEventListener('click', () => {
    if (pendingDeleteMsgId) {
        const el = document.getElementById(pendingDeleteMsgId);
        if (el) el.remove();
    }
    pendingDeleteMsgId = null;
    deleteModal.style.display = 'none';
});

btnDeleteForEveryone.addEventListener('click', () => {
    if (pendingDeleteMsgId) {
        socket.emit('delete-message-everyone', { msgId: pendingDeleteMsgId, userId: currentUserId });
    }
    pendingDeleteMsgId = null;
    deleteModal.style.display = 'none';
});

socket.on('message-deleted-everyone', (data) => {
    const el = document.getElementById(data.msgId);
    if (el) {
        el.innerHTML = `<em>Pesan ini telah dihapus</em>`;
    }
});
        
