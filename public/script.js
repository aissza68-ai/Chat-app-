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

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const vnBtn = document.getElementById('vn-btn');
const recordingBox = document.getElementById('recording-box');
const recTimer = document.getElementById('rec-timer');
const cancelRecBtn = document.getElementById('cancel-rec-btn');
const stopSendRecBtn = document.getElementById('stop-send-rec-btn');

const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
const videoBtn = document.getElementById('video-btn');
const videoInput = document.getElementById('video-input');

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
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            const audioFile = new File([audioBlob], `vn-${Date.now()}.mp3`, { type: 'audio/mp3' });
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

// UPLOAD MEDIA (IMAGE & VIDEO)
imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFileWithProgress(file, 'image');
});

videoBtn.addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFileWithProgress(file, 'video');
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
        if (data.success) {
            socket.emit('chat message', {
                type: type,
                fileUrl: `/uploads/${data.filename}`,
                sender: currentUsername,
                userId: currentUserId
            });
        }
    })
    .catch(err => console.error('Upload gagal:', err));
}

// MENAMPILKAN PESAN DI CHAT
socket.on('chat message', (msg) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');

    let contentHTML = '';
    if (msg.type === 'image') {
        contentHTML = `<img src="${msg.fileUrl}" style="max-width: 100%; border-radius: 8px;" />`;
    } else if (msg.type === 'video') {
        contentHTML = `<video src="${msg.fileUrl}" controls style="max-width: 100%; border-radius: 8px;"></video>`;
    } else if (msg.type === 'audio') {
        contentHTML = `<audio src="${msg.fileUrl}" controls style="width: 100%;"></audio>`;
    } else {
        contentHTML = `<p>${msg.text}</p>`;
    }

    msgDiv.innerHTML = `<strong>${msg.sender}</strong><br>${contentHTML}`;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});
