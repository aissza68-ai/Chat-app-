const socket = io();

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

const headerUserName = document.getElementById('header-user-name');
const headerUserId = document.getElementById('header-user-id');
const onlineCountEl = document.getElementById('online-count');
const onlineUsersList = document.getElementById('online-users-list');

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
const uploadOverlay = document.getElementById('upload-overlay');
const uploadStatusText = document.getElementById('upload-status-text');

const mediaPreviewModal = document.getElementById('media-preview-modal');
const previewImage = document.getElementById('preview-image');
const previewVideo = document.getElementById('preview-video');

// EFEK SUARA (WEB AUDIO API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (type === 'send') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'receive') {
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.frequency.setValueAtTime(800, now);
        osc2.frequency.setValueAtTime(1050, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.3);
    }
}

// UPDATE USER ONLINE
socket.on('update-online-users', (users) => {
    if (onlineCountEl) onlineCountEl.innerText = users.length;
    if (!onlineUsersList) return;

    onlineUsersList.innerHTML = '';
    users.forEach(u => {
        const card = document.createElement('div');
        card.className = 'online-user-card';
        card.innerHTML = `
            <span class="online-mini-dot"></span>
            <span class="online-name">${u.username || 'User'}</span>
            <span class="online-id-badge">ID: ${u.userId}</span>
        `;
        onlineUsersList.appendChild(card);
    });
});

// AUTO LOGIN & CEK ID
window.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('chat_userId');
    const savedPassword = localStorage.getItem('chat_password');
    if (savedUserId && savedPassword) {
        socket.emit('user-login', { userId: savedUserId, password: savedPassword, name: '' });
    }
});

if (inputUserId) {
    inputUserId.addEventListener('input', () => {
        const val = inputUserId.value.trim();
        if (val.length > 0) {
            socket.emit('check-user-id', val);
        } else {
            if (nameGroup) nameGroup.style.display = 'block';
            if (btnLogin) btnLogin.innerText = 'Masuk / Daftar';
        }
    });
}

socket.on('check-user-id-result', (res) => {
    if (res.exists) {
        if (nameGroup) nameGroup.style.display = 'none';
        if (btnLogin) btnLogin.innerText = 'Masuk';
    } else {
        if (nameGroup) nameGroup.style.display = 'block';
        if (btnLogin) btnLogin.innerText = 'Daftar Baru';
    }
});

function executeLogin(e) {
    if (e) e.preventDefault();
    const userId = inputUserId ? inputUserId.value.trim() : '';
    const password = inputPassword ? inputPassword.value.trim() : '';
    const name = inputName ? inputName.value.trim() : '';

    if (!userId || !password) return alert('ID dan Password wajib diisi!');
    if (audioCtx.state === 'suspended') audioCtx.resume();
    socket.emit('user-login', { userId, password, name });
}

if (btnLogin) btnLogin.onclick = executeLogin;
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.onsubmit = executeLogin;

socket.on('login-response', (res) => {
    if (res.success) {
        currentUserId = res.userId;
        currentUsername = res.username;

        if (headerUserName) headerUserName.innerText = currentUsername;
        if (headerUserId) headerUserId.innerText = `ID: ${currentUserId}`;

        localStorage.setItem('chat_userId', res.userId);
        const passVal = inputPassword ? inputPassword.value.trim() : localStorage.getItem('chat_password');
        if (passVal) localStorage.setItem('chat_password', passVal);

        if (loginScreen) loginScreen.style.display = 'none';
        if (chatScreen) chatScreen.style.display = 'flex';

        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            if (res.history && Array.isArray(res.history)) {
                res.history.forEach(msg => renderMessage(msg));
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } else {
        alert(res.message || 'Gagal masuk!');
        localStorage.removeItem('chat_userId');
        localStorage.removeItem('chat_password');
    }
});

// NOTIFIKASI BROWSER
function showNotification(msg) {
    if (!("Notification" in window)) return;
    if (document.hidden && Notification.permission === "granted" && msg.userId !== currentUserId) {
        let title = `Pesan dari ${msg.sender}`;
        let bodyText = msg.type === 'text' ? msg.text : `[${msg.type.toUpperCase()}]`;
        new Notification(title, { body: bodyText, icon: '/favicon.ico' });
    }
}

// REPLY & TYPING
if (cancelReplyBtn) {
    cancelReplyBtn.onclick = () => {
        selectedReplyMsg = null;
        if (replyPreview) replyPreview.style.display = 'none';
    };
}

function setReplyMessage(msgData) {
    selectedReplyMsg = msgData;
    if (replyName) replyName.innerText = msgData.sender;
    if (replyText) replyText.innerText = msgData.type === 'text' ? msgData.text : `[${msgData.type.toUpperCase()}]`;
    if (replyPreview) replyPreview.style.display = 'flex';
    if (messageInput) messageInput.focus();
}

if (messageInput) {
    messageInput.addEventListener('input', () => {
        socket.emit('typing', { username: currentUsername, isTyping: messageInput.value.length > 0 });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { username: currentUsername, isTyping: false });
        }, 2000);
    });
}

socket.on('display-typing', (data) => {
    if (!typingIndicator) return;
    if (data.isTyping && data.username !== currentUsername) {
        typingIndicator.innerText = `${data.username} sedang mengetik...`;
        typingIndicator.style.display = 'inline-block';
    } else {
        typingIndicator.style.display = 'none';
    }
});

// KIRIM PESAN
function sendTextMessage() {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;

    const msgData = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: 'text',
        text: text,
        sender: currentUsername || 'User',
        userId: currentUserId,
        replyTo: selectedReplyMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    renderMessage(msgData);
    playSound('send');
    socket.emit('chat message', msgData);

    messageInput.value = '';
    selectedReplyMsg = null;
    if (replyPreview) replyPreview.style.display = 'none';
    socket.emit('typing', { username: currentUsername, isTyping: false });
}

if (sendBtn) sendBtn.onclick = sendTextMessage;
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendTextMessage();
        }
    });
}

// VOICE NOTE
if (vnBtn) {
    vnBtn.onclick = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert('Mikrofon tidak didukung.');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
            mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.start();
            recSeconds = 0;
            if (recTimer) recTimer.innerText = '00:00';
            if (recordingBox) recordingBox.style.display = 'flex';

            recTimerInterval = setInterval(() => {
                recSeconds++;
                const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
                const s = String(recSeconds % 60).padStart(2, '0');
                if (recTimer) recTimer.innerText = `${m}:${s}`;
            }, 1000);
        } catch (err) {
            alert('Izin mikrofon ditolak.');
        }
    };
}

if (cancelRecBtn) cancelRecBtn.onclick = () => stopRecording(false);
if (stopSendRecBtn) stopSendRecBtn.onclick = () => stopRecording(true);

function stopRecording(send) {
    if (!mediaRecorder) return;
    clearInterval(recTimerInterval);
    if (recordingBox) recordingBox.style.display = 'none';

    mediaRecorder.onstop = () => {
        if (send && audioChunks.length > 0) {
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.webm`, { type: mimeType });
            uploadFileWithProgress(audioFile, 'Voice Note');
        }
        audioChunks = [];
        if (mediaRecorder.stream) mediaRecorder.stream.getTracks().forEach(t => t.stop());
        mediaRecorder = null;
    };
    mediaRecorder.stop();
}

// UPLOAD MEDIA
if (imageBtn) imageBtn.onclick = () => imageInput.click();
if (imageInput) {
    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) uploadFileWithProgress(file, 'Gambar');
        imageInput.value = '';
    };
}

if (videoBtn) videoBtn.onclick = () => videoInput.click();
if (videoInput) {
    videoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) uploadFileWithProgress(file, 'Video');
        videoInput.value = '';
    };
}

function uploadFileWithProgress(file, typeName) {
    const formData = new FormData();
    formData.append('file', file);
    if (uploadOverlay) {
        if (uploadStatusText) uploadStatusText.innerText = `Mengunggah ${typeName}...`;
        uploadOverlay.style.display = 'flex';
    }

    fetch('/upload', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (uploadOverlay) uploadOverlay.style.display = 'none';
        if (data.success && data.fileUrl) {
            let msgType = typeName === 'Video' ? 'video' : (typeName === 'Voice Note' ? 'audio' : 'image');
            const msgData = {
                id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                type: msgType,
                fileUrl: data.fileUrl,
                sender: currentUsername || 'User',
                userId: currentUserId,
                replyTo: selectedReplyMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            renderMessage(msgData);
            playSound('send');
            socket.emit('chat message', msgData);
            selectedReplyMsg = null;
            if (replyPreview) replyPreview.style.display = 'none';
        } else {
            alert('Gagal mengunggah file.');
        }
    }).catch(() => {
        if (uploadOverlay) uploadOverlay.style.display = 'none';
        alert('Kesalahan koneksi.');
    });
}

window.openMediaPreview = function(url, type) {
    if (!mediaPreviewModal) return;
    if (type === 'image') {
        previewImage.src = url;
        previewImage.style.display = 'block';
        previewVideo.style.display = 'none';
        previewVideo.pause();
    } else {
        previewVideo.src = url;
        previewVideo.style.display = 'block';
        previewImage.style.display = 'none';
    }
    mediaPreviewModal.style.display = 'flex';
};

window.closeMediaPreview = function() {
    if (!mediaPreviewModal) return;
    mediaPreviewModal.style.display = 'none';
    if (previewVideo) previewVideo.pause();
};

// RENDER PESAN
socket.on('chat message', (msg) => {
    renderMessage(msg);
    if (msg.userId !== currentUserId) playSound('receive');
    showNotification(msg);
});

function renderMessage(msg) {
    if (!messagesContainer) return;
    if (document.getElementById(msg.id)) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = msg.id;
    const isSelf = msg.userId === currentUserId;
    msgDiv.classList.add('message', isSelf ? 'self' : 'other');

    if (msg.deleted) {
        msgDiv.innerHTML = `<em>Pesan ini telah dihapus</em>`;
        messagesContainer.appendChild(msgDiv);
        return;
    }

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
        contentHTML = `<img src="${msg.fileUrl}" class="chat-media" onclick="openMediaPreview('${msg.fileUrl}', 'image')" />`;
    } else if (msg.type === 'video') {
        contentHTML = `<video src="${msg.fileUrl}" class="chat-media" onclick="openMediaPreview('${msg.fileUrl}', 'video')"></video>`;
    } else if (msg.type === 'audio') {
        contentHTML = `<audio src="${msg.fileUrl}" controls class="chat-vn" preload="metadata"></audio>`;
    } else {
        contentHTML = `<p>${msg.text}</p>`;
    }

    const deleteBtnHTML = `<span class="delete-icon" onclick="openDeleteModal('${msg.id}', '${msg.userId}')">&times;</span>`;

    msgDiv.innerHTML = `
        ${deleteBtnHTML}
        <span class="msg-sender">${msg.sender}</span>
        ${replyHTML}
        ${contentHTML}
        <div class="msg-footer">
            <small class="msg-time">${msg.timestamp || ''}</small>
        </div>
    `;

    // Swipe Balas
    let startX = 0, currentX = 0;
    msgDiv.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    msgDiv.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        if (diff > 0 && diff < 80) msgDiv.style.transform = `translateX(${diff}px)`;
    }, { passive: true });
    msgDiv.addEventListener('touchend', () => {
        let diff = currentX - startX;
        msgDiv.style.transform = 'translateX(0px)';
        if (diff > 50) setReplyMessage(msg);
        startX = 0; currentX = 0;
    });

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// HAPUS PESAN
window.openDeleteModal = function(msgId, msgUserId) {
    pendingDeleteMsgId = msgId;
    if (deleteModal) deleteModal.style.display = 'flex';
    if (btnDeleteForEveryone) {
        btnDeleteForEveryone.style.display = (msgUserId === currentUserId) ? 'block' : 'none';
    }
};

if (btnCancelDelete) {
    btnCancelDelete.onclick = () => {
        pendingDeleteMsgId = null;
        if (deleteModal) deleteModal.style.display = 'none';
    };
}

if (btnDeleteForMe) {
    btnDeleteForMe.onclick = () => {
        if (pendingDeleteMsgId) {
            const el = document.getElementById(pendingDeleteMsgId);
            if (el) el.remove();
        }
        pendingDeleteMsgId = null;
        if (deleteModal) deleteModal.style.display = 'none';
    };
}

if (btnDeleteForEveryone) {
    btnDeleteForEveryone.onclick = () => {
        if (pendingDeleteMsgId) {
            socket.emit('delete-message-everyone', { msgId: pendingDeleteMsgId, userId: currentUserId });
        }
        pendingDeleteMsgId = null;
        if (deleteModal) deleteModal.style.display = 'none';
    };
}

socket.on('message-deleted-everyone', (data) => {
    const el = document.getElementById(data.msgId);
    if (el) el.innerHTML = `<em>Pesan ini telah dihapus</em>`;
});
