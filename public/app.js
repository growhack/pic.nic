const socket = io();
let localStream;
let peerConnections = {};
const remoteAudio = document.getElementById('remote-audio');
const usersList = document.getElementById('users');

let username = prompt("Введите ваше имя:") || 'Гость';

socket.emit('user-joined', username);

socket.on('update-users', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        usersList.appendChild(li);
        
        // Инициализируем соединение с каждым пользователем
        if (user !== username) {
            initiatePeerConnection(user);
        }
    });
});

// Получаем доступ к аудио
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        localStream = stream;
    })
    .catch(err => console.error('Ошибка доступа к медиаустройствам.', err));

// Инициализация соединения
function initiatePeerConnection(remoteUser) {
    const peerConnection = new RTCPeerConnection();
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = event => {
        remoteAudio.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', { to: remoteUser, candidate: event.candidate });
        }
    };

    peerConnection.createOffer()
        .then(offer => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            socket.emit('webrtc-offer', { to: remoteUser, sdp: peerConnection.localDescription });
        });

    peerConnections[remoteUser] = peerConnection;
}

// Обработка WebRTC сигналов
socket.on('webrtc-offer', data => {
    const peerConnection = new RTCPeerConnection();
    peerConnections[data.from] = peerConnection;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => peerConnection.createAnswer())
        .then(answer => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            socket.emit('webrtc-answer', { to: data.from, sdp: peerConnection.localDescription });
        });
});

socket.on('webrtc-answer', data => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
});

socket.on('ice-candidate', data => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});
