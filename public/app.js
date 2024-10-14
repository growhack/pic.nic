const socket = io();
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const chatOutput = document.getElementById('chat-output');
const usersList = document.getElementById('users');
const volumeSlider = document.getElementById('volume-slider');
const volumeIndicator = document.getElementById('volume-indicator');
const tabsContainer = document.getElementById('tabs');

let username = prompt("Введите ваше имя:") || 'Гость';
let mediaStream;
let activeTabId = 'chat';
let openPrivateChats = {};
let privateMessages = {};
let peerConnections = {};

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
                <button id="ls-${user}" onclick="startPrivateMessage('${user}')" style="margin-left: 10px;">ЛС</button>
            </div>
        `;

        li.prepend(indicator);
        usersList.appendChild(li);
        
        if (user !== username) {
            initiatePeerConnection(user);
        }
    });
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

socket.on('chat-message', (messageObj) => {
    addChatMessage(messageObj);
});

// Функция для начала личного сообщения
function startPrivateMessage(user) {
    if (!openPrivateChats[user]) {
        openPrivateChats[user] = true;
        createPrivateMessageTab(user);
        switchToPrivateMessageTab(user);
    } else {
        alert(`ЛС с ${user} уже открыто.`);
    }
}

// Отправка сообщения в общий чат или в ЛС
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

        if (activeTabId === 'chat') {
            socket.emit('chat-message', messageObj);
            addChatMessage(messageObj);
        } else if (activeTabId.startsWith('private-')) {
            const recipient = activeTabId.split('-')[1];
            socket.emit('private-message', { to: recipient, msg: messageObj.msg });
        }

        chatInput.value = '';
    }
}

function addChatMessage(messageObj) {
    const p = document.createElement('p');
    p.textContent = `${messageObj.from}: ${messageObj.msg}`;
    chatOutput.appendChild(p);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

socket.on('private-message', (messageObj) => {
    if (!openPrivateChats[messageObj.from]) {
        startPrivateMessage(messageObj.from);
    }
    addPrivateMessage(messageObj);
});

function addPrivateMessage(messageObj) {
    const privateOutput = document.getElementById(`private-message-output-${messageObj.from}`);
    if (privateOutput) {
        const p = document.createElement('p');
        p.innerHTML = `<strong>${messageObj.from}:</strong> ${messageObj.msg}`;
        privateOutput.appendChild(p);
        privateOutput.scrollTop = privateOutput.scrollHeight; 
    } else {
        console.error(`Контейнер для сообщений от ${messageObj.from} не найден!`);
    }
}

function createPrivateMessageTab(user) {
    const tab = document.createElement('div');
    tab.classList.add('tab');
    tab.innerHTML = `${user} (ЛС) <button class="close" onclick="closePrivateChat('${user}')">✖</button>`;
    tab.onclick = () => switchToPrivateMessageTab(user);
    tabsContainer.insertBefore(tab, tabsContainer.querySelector('.plus'));

    const privateMessageDiv = document.createElement('div');
    privateMessageDiv.id = `private-message-output-${user}`;
    privateMessageDiv.className = 'private-message-output';
    document.body.appendChild(privateMessageDiv);
    privateMessageDiv.style.display = 'none';
}

function switchToPrivateMessageTab(user) {
    activeTabId = `private-${user}`;
    const privateMessageDiv = document.getElementById(`private-message-output-${user}`);
    if (privateMessageDiv) {
        privateMessageDiv.style.display = 'block';
    }

    const allPrivateMessages = document.querySelectorAll('.private-message-output');
    allPrivateMessages.forEach(div => {
        if (div.id !== `private-message-output-${user}`) {
            div.style.display = 'none';
        }
    });

    clearActiveTabs();
    setActiveTab(user);
}

function closePrivateChat(user) {
    delete openPrivateChats[user];
    const tabToClose = Array.from(tabsContainer.getElementsByClassName('tab')).find(tab => tab.innerText.includes(user));
    if (tabToClose) {
        tabsContainer.removeChild(tabToClose);
    }
    
    const privateMessageDiv = document.getElementById(`private-message-output-${user}`);
    if (privateMessageDiv) {
        document.body.removeChild(privateMessageDiv);
    }
}

function setActiveTab(user) {
    const tabs = tabsContainer.getElementsByClassName('tab');
    Array.from(tabs).forEach(tab => {
        tab.classList.remove('active');
    });

    const currentTab = Array.from(tabs).find(tab => tab.textContent.includes(user)) || null;
    if (currentTab) {
        currentTab.classList.add('active');
    }
}

function clearActiveTabs() {
    const tabs = tabsContainer.getElementsByClassName('tab');
    Array.from(tabs).forEach(tab => {
        tab.classList.remove('active');
    });
}

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        mediaStream = stream;
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        function updateVolumeIndicator() {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const volume = average / 256; 

            const indicator = document.getElementById(`indicator-${username}`);
            indicator.style.backgroundColor = volume > 0.1 ? 'green' : 'black';
            volumeIndicator.style.height = `${Math.min(volume * 100, 100)}%`;
            mediaStream.getAudioTracks()[0].enabled = volume < 0.8 && volume > 0.05;

            requestAnimationFrame(updateVolumeIndicator);
        }
        
        updateVolumeIndicator();
    })
    .catch(err => console.error('Ошибка доступа к медиаустройствам.', err));

volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value;
});
