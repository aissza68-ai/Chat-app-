const chatState = {
    currentUser: null,
    replyingTo: null,
    messages: []
};

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-btn') || document.querySelector('button[type="submit"]') || document.querySelector('.primary-btn');

    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
});

function handleLogin(e) {
    if (e) e.preventDefault();
    
    const userIdInput = document.getElementById('user-id') || document.querySelector('input[type="text"]');
    const userNameInput = document.getElementById('user-name') || document.querySelectorAll('input')[2];
    
    const userId = userIdInput ? userIdInput.value.trim() : "user_" + Math.floor(Math.random() * 1000);
    const userName = userNameInput ? userNameInput.value.trim() : "User";

    if (!userId) {
        alert("Masukkan ID Pengguna terlebih dahulu!");
        return;
    }

    chatState.currentUser = {
        id: userId,
        name: userName || userId
    };

    const loginScreen = document.getElementById('login-screen') || document.querySelector('.login-card')?.parentNode;
    const chatScreen = document.getElementById('chat-screen');

    if (loginScreen) loginScreen.style.display = 'none';
    if (chatScreen) {
        chatScreen.style.display = 'flex';
    } else {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        const mainChat = document.querySelector('.chat-container')?.parentNode;
        if(mainChat) mainChat.style.display = 'flex';
    }

    initChatApp();
}

function initChatApp() {
    if (typeof renderMessages === 'function' && chatState.messages.length > 0) {
        renderMessages(chatState.messages);
    }
}

function renderMessages(messagesArray) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    container.innerHTML = '';

    messagesArray.forEach((msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        const isSelf = chatState.currentUser && msg.senderId === chatState.currentUser.id;
        messageDiv.classList.add(isSelf ? 'self' : 'other');

        const isDeleted = msg.isDeleted || msg.text === "Pesan ini telah dihapus";

        if (isDeleted) {
            messageDiv.classList.add('deleted-message');
            messageDiv.innerHTML = `
                <div class="msg-content" style="font-style: italic; opacity: 0.7; color: inherit;">
                    Pesan ini telah dihapus
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <span class="msg-sender">${escapeHtml(msg.senderName || 'User')}</span>
                <div class="msg-text">${escapeHtml(msg.text)}</div>
                <div class="msg-footer">
                    <span class="msg-time">${escapeHtml(msg.time || '')}</span>
                </div>
            `;

            attachSwipeListener(messageDiv, msg);
        }

        container.appendChild(messageDiv);
    });

    container.scrollTop = container.scrollHeight;
}

function attachSwipeListener(element, messageData) {
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    element.addEventListener('touchstart', (e) => {
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

        if (diffX > 0 && diffX < 100) {
            element.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        
        let diffX = currentX - startX;
        element.style.transform = 'translateX(0px)';

        if (diffX > 60) {
            if (!messageData.isDeleted && messageData.text !== "Pesan ini telah dihapus") {
                triggerReplyPreview(messageData);
            }
        }
        
        startX = 0;
        currentX = 0;
    });
}

function triggerReplyPreview(messageData) {
    chatState.replyingTo = messageData;
    
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

function cancelReply() {
    chatState.replyingTo = null;
    const replyBox = document.getElementById('reply-preview-container');
    if (replyBox) {
        replyBox.style.display = 'none';
        replyBox.innerHTML = '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
