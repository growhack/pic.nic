const socket = io('https://localhost:3000'); // Используем HTTPS
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const chatOutput = document.getElementById('chat-output');
const usersList = document.getElementById('users');
const volumeIndicator = document.getElementById('volume-indicator');

let username = prompt("Введите ваше имя:") || 'Гость';
let mediaStream;
let peerConnections = {};

socket.emit('user-joined', username);

socket.on('update-users', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        usersList.appendChild(li);

        if (user !== username && !peerConnections[user]) {
            initiatePeerConnection(user);
        }
    });
});

function initiatePeerConnection(user) {
    const peerConnection = new RTCPeerConnection();
    peerConnections[user] = peerConnection;

    mediaStream.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, mediaStream);
    });

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', { to: user, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = event => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
    }).then(() => {
        socket.emit('webrtc-offer', { to: user, sdp: peerConnection.localDescription });
    });
}

socket.on('webrtc-offer', data => {
    const peerConnection = new RTCPeerConnection();
    peerConnections[data.from] = peerConnection;

    mediaStream.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, mediaStream);
    });

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
        return peerConnection.createAnswer();
    }).then(answer => {
        return peerConnection.setLocalDescription(answer);
    }).then(() => {
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

socket.on('chat-message', addChatMessage);

function addChatMessage(messageObj) {
    const p = document.createElement('p');
    p.textContent = `${messageObj.from}: ${messageObj.msg}`;
    chatOutput.appendChild(p);
}

navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
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
}).catch(err => console.error('Ошибка доступа к медиаустройствам.', err));
