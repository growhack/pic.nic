const socket = io('https://a01899e1-923f-4672-93ca-6bdb4e7326d8-00-2h0q4s1e6a027.sisko.replit.dev', {
    transports: ['websocket'], // Используем только WebSocket
});
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const chatOutput = document.getElementById('chat-output');
const usersList = document.getElementById('users');
const volumeSlider = document.getElementById('volume-slider');
const volumeIndicator = document.getElementById('volume-indicator');
const tabsContainer = document.getElementById('tabs');

let username;
let mediaStream;
let activeTabId = 'chat';
let openPrivateChats = {};
let peerConnections = {};

// Запрос имени пользователя
function requestUsername() {
    do {
        username = prompt("Введите ваше имя:");
    } while (!username);
}

// Запрашиваем имя
requestUsername();

// Уведомление о том, что пользователь присоединился
socket.emit('user-joined', username);

// Обновление списка пользователей
socket.on('update-users', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        const indicator = document.createElement('span');
        indicator.classList.add('user-indicator');
        indicator.id = `indicator-${user}`;

        li.innerHTML = `
            <div class="username-container">
                <span>${user}</span>
            </div>
        `;
        li.prepend(indicator);
        usersList.appendChild(li);
    });
});

// Проверка подключения
socket.on('connect', () => {
    console.log('Подключён к серверу:', socket.id);
});

// Инициация WebRTC соединения для пользователя
function initiatePeerConnection(user) {
    const peerConnection = new RTCPeerConnection();

    mediaStream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, mediaStream); 
    });

    peerConnection.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { to: user, candidate: event.candidate });
        }
    };

    peerConnection.createOffer()
        .then((offer) => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            socket.emit('webrtc-offer', { to: user, sdp: peerConnection.localDescription });
        });

    peerConnections[user] = peerConnection;
}

socket.on('webrtc-offer', (data) => {
    const peerConnection = new RTCPeerConnection();
    peerConnections[data.from] = peerConnection;

    mediaStream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, mediaStream);
    });

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => peerConnection.createAnswer())
        .then((answer) => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            socket.emit('webrtc-answer', { to: data.from, sdp: peerConnection.localDescription });
        });
});

socket.on('webrtc-answer', (data) => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
});

socket.on('ice-candidate', (data) => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// Обработка получения сообщения
socket.on('chat-message', (messageObj) => {
    addChatMessage(messageObj);
});

// Функция для отправки сообщения
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (msg) {
        const messageObj = { from: username, msg };
        socket.emit('chat-message', messageObj); // Отправляем сообщение на сервер
        addChatMessage(messageObj); // Добавляем сообщение в локальный чат
        chatInput.value = '';
    }
}

function addChatMessage(messageObj) {
    const p = document.createElement('p');
    p.textContent = `${messageObj.from}: ${messageObj.msg}`;
    chatOutput.appendChild(p);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

// Запрашиваем доступ к микрофону
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        mediaStream = stream;
    })
    .catch(err => console.error('Ошибка доступа к медиаустройствам.', err));

volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value;
});
