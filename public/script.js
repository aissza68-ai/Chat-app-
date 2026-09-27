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

// Element UI
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
const uploadProgress = document.getElementById('upload-progress');

// Status Online
socket.on('update-online-count', (count) => {
    if (onlineCountEl) onlineCountEl.innerText = count;
});

// Auto Login & Checking
window.addEventListener('DOMContentLoaded', () => {
    const savedUserId = localStorage.getItem('chat_userId');
    const savedPassword = localStorage.getItem('chat_password');
    if (savedUserId && savedPassword) {
        socket.emit('user-login', { userId: savedUserId, password: savedPassword });
    }
});

if (inputUserId) {
    inputUserId.addEventListener('input', () => {
        const val = inputUserId.value.trim();
        if (val.length >= 4) {
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

    if (!userId) return alert('Silakan isi ID Pengguna!');
    if (!password) return alert('Silakan isi Password!');

    socket.emit('user-login', { userId, password, name });
}

if (btnLogin) btnLogin.onclick = executeLogin;
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.onsubmit = executeLogin;

socket.on('login-response', (res) => {
    if (res.success) {
        currentUserId = res.userId;
        currentUsername = res.username;

        // Perbarui Header Nama dan ID
        if (headerUserName) headerUserName.innerText = currentUsername;
        if (headerUserId) headerUserId.innerText = `ID: ${currentUserId}`;

        localStorage.setItem('chat_userId', res.userId);
        const passVal = inputPassword ? inputPassword.value.trim() : localStorage.getItem('chat_password');
        if (passVal) localStorage.setItem('chat_password', passVal);

        if (loginScreen) loginScreen.style.display = 'none';
        if (chatScreen) chatScreen.style.display = 'flex';

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

// Media Upload
if (imageBtn) imageBtn.onclick = () => imageInput.click();
if (imageInput) {
    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) uploadFileWithProgress(file, 'image');
        imageInput.value = '';
    };
}

if (videoBtn) videoBtn.onclick = () => videoInput.click();
if (videoInput) {
    videoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) uploadFileWithProgress(file, 'video');
        videoInput.value = '';
    };
}

function uploadFileWithProgress(file, type) {
    const formData = new FormData();
    formData.append('file', file);

    if (uploadProgress) {
        uploadProgress.innerText = `Mengunggah ${type}...`;
        uploadProgress.style.display = 'inline-block';
    }

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (uploadProgress) uploadProgress.style.display = 'none';

        if (data.success && data.fileUrl) {
            const msgData = {
                id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                type: type,
                fileUrl: data.fileUrl,
                sender: currentUsername || 'User',
                userId: currentUserId,
                replyTo: selectedReplyMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            renderMessage(msgData);
            socket.emit('chat message', msgData);

            selectedReplyMsg = null;
            if (replyPreview) replyPreview.style.display = 'none';
        } else {
            alert('Gagal mengunggah file.');
        }
    })
    .catch(err => {
        if (uploadProgress) uploadProgress.style.display = 'none';
        alert('Terjadi kesalahan koneksi.');
    });
}

// Render Messages & Swipe to Reply
socket.on('chat message', (msg) => {
    renderMessage(msg);
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
        contentHTML = `<img src="${msg.fileUrl}" style="max-width: 100%; border-radius: 12px;" />`;
    } else if (msg.type === 'video') {
        contentHTML = `<video src="${msg.fileUrl}" controls playsinline preload="metadata" style="max-width: 100%; border-radius: 12px;"></video>`;
    } else if (msg.type === 'audio') {
        contentHTML = `<audio src="${msg.fileUrl}" controls preload="metadata" style="width: 100%;"></audio>`;
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

    // Swipe Balas Pesan
    let startX = 0;
    let currentX = 0;

    msgDiv.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    msgDiv.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        if (diff > 0 && diff < 80) {
            msgDiv.style.transform = `translateX(${diff}px)`;
        }
    }, { passive: true });

    msgDiv.addEventListener('touchend', () => {
        let diff = currentX - startX;
        msgDiv.style.transform = 'translateX(0px)';
        if (diff > 50) {
            setReplyMessage(msg);
        }
        startX = 0;
        currentX = 0;
    });

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Delete Message Handling
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
    if (el) {
        el.innerHTML = `<em>Pesan ini telah dihapus</em>`;
    }
});
    
