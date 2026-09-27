const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
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

// Elemen UI dideklarasikan di dalam fungsi init atau setelah DOM siap untuk mencegah null
let loginScreen, chatScreen, inputUserId, inputPassword, inputName, nameGroup, btnLogin, loginForm;
let headerUserName, headerUserId, onlineCountEl, onlineUsersList;
let messagesContainer, messageInput, sendBtn, typingIndicator;
let replyPreview, replyName, replyText, cancelReplyBtn;
let deleteModal, btnDeleteForMe, btnDeleteForEveryone, btnCancelDelete;
let vnBtn, recordingBox, recTimer, cancelRecBtn, stopSendRecBtn;
let imageBtn, imageInput, videoBtn, videoInput, uploadOverlay, uploadStatusText;
let mediaPreviewModal, previewImage, previewVideo;

// ==========================================
// EFEK SUARA (WEB AUDIO API GENERATOR)
// ==========================================
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioContext();
        if (type === 'send') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'receive') {
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(800, now);
            osc2.frequency.setValueAtTime(1050, now + 0.08);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.08);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.3);
        }
    } catch (e) {
        console.log("Audio not allowed yet");
    }
}

// Inisialisasi setelah DOM sepenuhnya siap
window.addEventListener('DOMContentLoaded', () => {
    loginScreen = document.getElementById('login-screen');
    chatScreen = document.getElementById('chat-screen');
    inputUserId = document.getElementById('input-user-id');
    inputPassword = document.getElementById('input-password');
    inputName = document.getElementById('input-name');
    nameGroup = document.getElementById('name-group');
    btnLogin = document.getElementById('btn-login');
    loginForm = document.getElementById('login-form');

    headerUserName = document.getElementById('header-user-name');
    headerUserId = document.getElementById('header-user-id');
    onlineCountEl = document.getElementById('online-count');
    onlineUsersList = document.getElementById('online-users-list');

    messagesContainer = document.getElementById('messages');
    messageInput = document.getElementById('message-input');
    sendBtn = document.getElementById('send-btn');
    typingIndicator = document.getElementById('typing-indicator');

    replyPreview = document.getElementById('reply-preview');
    replyName = document.getElementById('reply-name');
    replyText = document.getElementById('reply-text');
    cancelReplyBtn = document.getElementById('cancel-reply');

    deleteModal = document.getElementById('delete-modal');
    btnDeleteForMe = document.getElementById('btn-delete-forme');
    btnDeleteForEveryone = document.getElementById('btn-delete-foreveryone');
    btnCancelDelete = document.getElementById('btn-cancel-delete');

    vnBtn = document.getElementById('vn-btn');
    recordingBox = document.getElementById('recording-box');
    recTimer = document.getElementById('rec-timer');
    cancelRecBtn = document.getElementById('cancel-rec-btn');
    stopSendRecBtn = document.getElementById('stop-send-rec-btn');

    imageBtn = document.getElementById('image-btn');
    imageInput = document.getElementById('image-input');
    videoBtn = document.getElementById('video-btn');
    videoInput = document.getElementById('video-input');
    uploadOverlay = document.getElementById('upload-overlay');
    uploadStatusText = document.getElementById('upload-status-text');

    mediaPreviewModal = document.getElementById('media-preview-modal');
    previewImage = document.getElementById('preview-image');
    previewVideo = document.getElementById('preview-video');

    // Event listener input ID untuk cek apakah user sudah terdaftar
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

    // Tangani aksi submit login/daftar
    const handleLoginAction = (e) => {
        if (e) e.preventDefault();
        const userId = inputUserId ? inputUserId.value.trim() : '';
        const password = inputPassword ? inputPassword.value.trim() : '';
        const name = inputName ? inputName.value.trim() : '';

        if (!userId) {
            alert('Silakan isi ID Pengguna!');
            return;
        }
        if (!password) {
            alert('Silakan isi Password!');
            return;
        }

        getAudioContext();
        socket.emit('user-login', { userId, password, name });
    };

    if (btnLogin) btnLogin.onclick = handleLoginAction;
    if (loginForm) loginForm.onsubmit = handleLoginAction;

    // Cek Auto Login dari LocalStorage
    const savedUserId = localStorage.getItem('chat_userId');
    const savedPassword = localStorage.getItem('chat_password');
    if (savedUserId && savedPassword) {
        socket.emit('user-login', { userId: savedUserId, password: savedPassword, name: '' });
    }
});

// UPDATE DAFTAR PENGGUNA ONLINE
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
        card.onclick = () => {
            if (messageInput) {
                messageInput.value += `@${u.username} `;
                messageInput.focus();
            }
        };
        onlineUsersList.appendChild(card);
    });
});

socket.on('check-user-id-result', (res) => {
    if (res.exists) {
        if (nameGroup) nameGroup.style.display = 'none';
        if (btnLogin) btnLogin.innerText = 'Masuk';
    } else {
        if (nameGroup) nameGroup.style.display = 'block';
        if (btnLogin) btnLogin.innerText = 'Daftar Baru';
    }
});

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

// NOTIFIKASI BROWSER DENGAN MENTION
function showNotification(msg) {
    if (!("Notification" in window)) return;

    if (document.hidden && Notification.permission === "granted" && msg.userId !== currentUserId) {
        let title = `Pesan dari ${msg.sender}`;
        let bodyText = '';

        const isTagged = msg.text && (msg.text.includes(`@${currentUsername}`) || msg.text.includes('@everyone') || msg.text.includes('@all'));
        if (isTagged) {
            title = `🔔 Anda dimention oleh ${msg.sender}!`;
        }

        if (msg.type === 'image') bodyText = '📷 Mengirim gambar';
        else if (msg.type === 'video') bodyText = '🎥 Mengirim video';
        else if (msg.type === 'audio') bodyText = '🎙️ Mengirim voice note';
        else bodyText = msg.text;

        const notification = new Notification(title, {
            body: bodyText,
            icon: '/favicon.ico'
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
}

// Reply Preview
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

// Typing Status
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

// Send Text Message
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

// Voice Note Recording
if (vnBtn) {
    vnBtn.onclick = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return alert('Akses mikrofon tidak didukung browser ini.');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];

            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
            else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };

            mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

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
            const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';

            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.${ext}`, { type: mimeType });
            uploadFileWithProgress(audioFile, 'Voice Note');
        }
        audioChunks = [];
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorder = null;
    };

    mediaRecorder.stop();
}

// Media Upload
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

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (uploadOverlay) uploadOverlay.style.display = 'none';

        if (data.success && data.fileUrl) {
            let msgType = 'image';
            if (typeName === 'Video') msgType = 'video';
            if (typeName === 'Voice Note') msgType = 'audio';

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
    })
    .catch(() => {
        if (uploadOverlay) uploadOverlay.style.display = 'none';
        alert('Terjadi kesalahan koneksi.');
    });
}

// Peninjauan Foto / Video
window.openMediaPreview = function(url, type) {
    if (!mediaPreviewModal) return;
    if (type === 'image') {
        previewImage.src = url;
        previewImage.style.display = 'block';
        previewVideo.style.display = 'none';
        previewVideo.pause();
    } else if (type === 'video') {
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

// Render Messages & Highlighting Tag/Mention
socket.on('chat message', (msg) => {
    renderMessage(msg);
    if (msg.userId !== currentUserId) {
        playSound('receive');
    }
    showNotification(msg);
});

function formatMentions(text) {
    if (!text) return '';
    let formatted = text.replace(/(@everyone|@all)/gi, '<span class="mention-tag mention-all">$1</span>');
    formatted = formatted.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention-tag">@$1</span>');
    return formatted;
}

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
        contentHTML = `<p>${formatMentions(msg.text)}</p>`;
    }

    const deleteBtnHTML = `<span class="delete-icon" onclick="openDeleteModal('${msg.id}', '${msg.userId}')">&times;</span>`;

    msgDiv.innerHTML = `
        ${deleteBtnHTML}
        <span class="msg-sender" onclick="tagUserFromChat('${msg.sender}')" style="cursor: pointer;">${msg.sender}</span>
        ${replyHTML}
        ${contentHTML}
        <div class="msg-footer">
            <smal
