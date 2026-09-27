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

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const inputUserId = document.getElementById('input-user-id');
const inputPassword = document.getElementById('input-password');
const inputName = document.getElementById('input-name');
const nameGroup = document.getElementById('name-group');
const btnLogin = document.getElementById('btn-login');

const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const imageInput = document.getElementById('image-input');
const videoInput = document.getElementById('video-input');
const imageBtn = document.getElementById('image-btn');
const videoBtn = document.getElementById('video-btn');
const vnBtn = document.getElementById('vn-btn');
const onlineCountElem = document.getElementById('online-count');
const onlineUsersList = document.getElementById('online-users-list');
const typingIndicator = document.getElementById('typing-indicator');

const recordingBox = document.getElementById('recording-box');
const recTimer = document.getElementById('rec-timer');
const cancelRecBtn = document.getElementById('cancel-rec-btn');
const stopSendRecBtn = document.getElementById('stop-send-rec-btn');

const uploadProgressBox = document.getElementById('upload-progress-box');
const uploadLabel = document.getElementById('upload-label');
const uploadPercent = document.getElementById('upload-percent');
const progressBarFill = document.getElementById('progress-bar-fill');

const replyPreview = document.getElementById('reply-preview');
const replySender = document.getElementById('reply-sender');
const replyText = document.getElementById('reply-text');
const cancelReplyBtn = document.getElementById('cancel-reply');

const customModal = document.getElementById('custom-modal');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

function attemptAutoLogin() {
    const savedUserId = localStorage.getItem('chat_userId');
    const savedPass = localStorage.getItem('chat_password');
    const savedName = localStorage.getItem('chat_name') || '';

    if (savedUserId && savedPass) {
        socket.emit('login-account', { userId: savedUserId, password: savedPass, name: savedName }, (res) => {
            if (res && res.success) {
                currentUserId = res.userId;
                currentUsername = res.name;
                loginScreen.style.display = 'none';
                chatScreen.style.display = 'flex';
            } else {
                localStorage.clear();
            }
        });
    }
}

window.addEventListener('load', attemptAutoLogin);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        attemptAutoLogin();
    }
});

socket.on('connect', () => {
    if (currentUserId) attemptAutoLogin();
});

inputUserId.addEventListener('input', () => {
    const userId = inputUserId.value.trim();
    if (userId.length === 4) {
        socket.emit('check-id', userId, (res) => {
            if (res && res.exists) {
                nameGroup.style.display = 'none';
                inputName.value = res.name;
            } else {
                nameGroup.style.display = 'block';
                inputName.value = '';
            }
        });
    }
});

btnLogin.addEventListener('click', () => {
    const userId = inputUserId.value.trim();
    const password = inputPassword.value.trim();
    const name = inputName.value.trim();

    if (userId.length !== 4) return alert('ID harus 4 angka!');
    if (password.length !== 6) return alert('Password harus 6 angka!');

    socket.emit('login-account', { userId, password, name }, (res) => {
        if (res && res.success) {
            currentUserId = res.userId;
            currentUsername = res.name;

            localStorage.setItem('chat_userId', userId);
            localStorage.setItem('chat_password', password);
            localStorage.setItem('chat_name', res.name);

            loginScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
        } else {
            alert(res.message || 'Gagal login');
        }
    });
});

function showUploadLoading(show, label = '', percent = 0) {
    if (show) {
        uploadProgressBox.style.display = 'block';
        uploadLabel.innerText = label;
        uploadPercent.innerText = `${percent}%`;
        progressBarFill.style.width = `${percent}%`;
    } else {
        uploadProgressBox.style.display = 'none';
        progressBarFill.style.width = '0%';
    }
}

function uploadFileWithProgress(file, type = 'media') {
    let typeLabel = 'Mengirim Foto...';
    if (type === 'video') typeLabel = 'Mengunggah & Mengompresi Video...';
    if (type === 'audio') typeLabel = 'Mengirim Voice Note...';

    showUploadLoading(true, typeLabel, 0);

    const formData = new FormData();
    formData.append('media', file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            if (percent === 100 && type === 'video') {
                showUploadLoading(true, '⏳ Mengolah & Memproses Video...', 100);
            } else {
                showUploadLoading(true, typeLabel, percent);
            }
        }
    };

    xhr.onload = function() {
        showUploadLoading(false);
        if (xhr.status === 200) {
            try {
                const res = JSON.parse(xhr.responseText);
                if (res.success) {
                    if (res.type === 'image') sendMessage({ image: res.url });
                    else if (res.type === 'video') sendMessage({ video: res.url });
                    else if (res.type === 'audio') sendMessage({ audio: res.url });
                } else {
                    alert('Gagal unggah: ' + res.message);
                }
            } catch (err) {
                alert('Respon server tidak valid.');
            }
        } else {
            alert('Gagal unggah media ke server!');
        }
    };

    xhr.onerror = function() {
        showUploadLoading(false);
        alert('Kesalahan jaringan saat mengunggah!');
    };

    xhr.send(formData);
}

// LOGIKA VOICE NOTE (RECORDING)
vnBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return alert('Perangkat/Browser Anda tidak mendukung perekaman suara.');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

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

cancelRecBtn.addEventListener('click', () => {
    stopRecording(false);
});

stopSendRecBtn.addEventListener('click', () => {
    stopRecording(true);
});

function stopRecording(send) {
    if (!mediaRecorder) return;

    clearInterval(recTimerInterval);
    recordingBox.style.display = 'none';

    mediaRecorder.onstop = () => {
        if (send && audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.webm`, { type: 'audio/webm' });
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

imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadFileWithProgress(file, 'image');
        imageInput.value = '';
    }
});

videoBtn.addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadFileWithProgress(file, 'video');
        videoInput.value = '';
    }
});

sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text) {
        if (!socket.connected) {
            socket.connect();
            attemptAutoLogin();
        }
        sendMessage({ text });
        messageInput.value = '';
        cancelReply();
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

function sendMessage(payload) {
    if (selectedReplyMsg) payload.replyTo = selectedReplyMsg;
    socket.emit('chat-message', payload);
    cancelReply();
}

messageInput.addEventListener('input', () => {
    socket.emit('typing', true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
    }, 2000);
});

socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingIndicator.innerHTML = `
            <span class="typing-dot-anim"></span>
            <span><b>${data.username}</b> sedang mengetik...</span>
        `;
        typingIndicator.style.display = 'inline-flex';
        scrollToBottom();
    } else {
        typingIndicator.style.display = 'none';
        typingIndicator.innerHTML = '';
    }
});

socket.on('online-count', (count) => {
    if (onlineCountElem) onlineCountElem.innerText = count;
});

socket.on('online-users-list', (userList) => {
    if (!onlineUsersList) return;
    onlineUsersList.innerHTML = '';

    userList.forEach(u => {
        const card = document.createElement('div');
        card.className = 'online-user-card';
        card.innerHTML = `
            <span class="online-dot"></span>
            <div class="user-card-info">
                <span class="user-card-name">${u.name}</span>
                <span class="user-card-id">ID: ${u.userId}</span>
            </div>
        `;
        onlineUsersList.appendChild(card);
    });
});

socket.on('system-message', (msg) => {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.innerText = msg;
    messagesContainer.appendChild(div);
    scrollToBottom();
});

socket.on('load-history', (history) => {
    messagesContainer.innerHTML = '';
    history.forEach(appendMessage);
    scrollToBottom();
});

socket.on('chat-message', (msg) => {
    appendMessage(msg);
    scrollToBottom();
});

socket.on('message-deleted', (msgId) => {
    const msgElem = document.getElementById(msgId);
    if (msgElem) {
        msgElem.dataset.deleted = "true";
        msgElem.className = `message deleted ${msgElem.classList.contains('my-message') ? 'my-message' : 'other-message'}`;
        msgElem.innerHTML = '<i>Pesan telah dihapus</i>';
    }
});

function appendMessage(msg) {
    const div = document.createElement('div');
    div.id = msg.id;
    div.className = `message ${msg.senderId === currentUserId ? 'my-message' : 'other-message'}`;

    if (msg.isDeleted) {
        div.dataset.deleted = "true";
        div.classList.add('deleted');
        div.innerHTML = '<i>Pesan telah dihapus</i>';
        messagesContainer.appendChild(div);
        return;
    }

    let replyHtml = '';
    if (msg.replyTo) {
        const replyTextShow = msg.replyTo.isDeleted ? 'Pesan telah dihapus' : (msg.replyTo.text || '[Media]');
        replyHtml = `
            <div class="reply-box">
                <small>${msg.replyTo.sender}</small>
                <p>${replyTextShow}</p>
            </div>
        `;
    }

    let mediaHtml = '';
    if (msg.image) mediaHtml += `<img src="${msg.image}" class="chat-media" onclick="window.open(this.src)" />`;
    if (msg.video) mediaHtml += `<video src="${msg.video}" controls preload="metadata" playsinline class="chat-media"></video>`;
    if (msg.audio) mediaHtml += `<audio src="${msg.audio}" controls class="chat-audio"></audio>`;

    let deleteBtn = msg.senderId === currentUserId ? `<span class="delete-btn" onclick="deleteMessage('${msg.id}')">🗑️</span>` : '';

    div.innerHTML = `
        ${replyHtml}
        <div class="msg-header">
            <b>${msg.sender}</b>
            ${deleteBtn}
        </div>
        ${msg.text ? `<p class="msg-body">${msg.text}</p>` : ''}
        ${mediaHtml}
        <span class="time">${msg.time}</span>
        <button class="btn-reply" onclick="setReply('${msg.id}', '${msg.sender}')">Balas</button>
    `;

    // Touch Swipe to Reply
    let startX = 0;
    let currentX = 0;

    div.addEventListener('touchstart', (e) => {
        if (div.dataset.deleted === "true") return;
        startX = e.touches[0].clientX;
    }, { passive: true });

    div.addEventListener('touchmove', (e) => {
        if (div.dataset.deleted === "true") return;
        currentX = e.touches[0].clientX;
        let diffX = currentX - startX;
        if (diffX > 0 && diffX < 80) {
            div.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    div.addEventListener('touchend', () => {
        if (div.dataset.deleted === "true") return;
        let diffX = currentX - startX;
        if (diffX > 50) {
            setReply(msg.id, msg.sender);
            messageInput.focus();
        }
        div.style.transform = 'translateX(0px)';
        startX = 0;
        currentX = 0;
    });

    messagesContainer.appendChild(div);
}

window.deleteMessage = function(msgId) {
    pendingDeleteMsgId = msgId;
    customModal.style.display = 'flex';
};

modalCancelBtn.addEventListener('click', () => {
    pendingDeleteMsgId = null;
    customModal.style.display = 'none';
});

modalConfirmBtn.addEventListener('click', () => {
    if (pendingDeleteMsgId) {
        socket.emit('delete-message', pendingDeleteMsgId);
        pendingDeleteMsgId = null;
    }
    customModal.style.display = 'none';
});

window.setReply = function(id, sender) {
    const msgElem = document.getElementById(id);
    if (!msgElem || msgElem.dataset.deleted === "true") return;

    const msgBody = msgElem.querySelector('.msg-body');
    const text = msgBody ? msgBody.innerText : '[Media]';

    selectedReplyMsg = { id, sender, text };
    replySender.innerText = sender;
    replyText.innerText = text;
    replyPreview.style.display = 'flex';
};

function cancelReply() {
    selectedReplyMsg = null;
    replyPreview.style.display = 'none';
}

cancelReplyBtn.addEventListener('click', cancelReply);

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
