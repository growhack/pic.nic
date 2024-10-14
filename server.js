const express = require('express');
const http = require('http'); // Уберите импорт HTTPS
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app); // Используйте HTTP
const io = socketIo(server);

app.use(express.static('public'));

let users = [];
let privateChats = {}; // Хранит информацию об открытых личных чатах

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        if (!users.includes(username)) {
            users.push(username);
            socket.username = username;
            io.emit('update-users', users);
        }
    });

    socket.on('chat-message', (msg) => {
        socket.broadcast.emit('chat-message', msg);
    });

    socket.on('private-message', (data) => {
        if (!privateChats[data.to]) {
            privateChats[data.to] = [];
        }
        privateChats[data.to].push({ from: socket.username, msg: data.msg });
        socket.to(data.to).emit('private-message', { from: socket.username, msg: data.msg });
        socket.to(data.to).emit('chat-open', { from: socket.username });
    });

    // Обработка сигналов WebRTC
    socket.on('webrtc-offer', (data) => {
        socket.to(data.to).emit('webrtc-offer', { from: socket.username, sdp: data.sdp });
    });

    socket.on('webrtc-answer', (data) => {
        socket.to(data.to).emit('webrtc-answer', { from: socket.username, sdp: data.sdp });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.username });
    });

    socket.on('disconnect', () => {
        users = users.filter((user) => user !== socket.username);
        io.emit('update-users', users);
    });
});

// Запуск сервера на порту, указанном Railway
server.listen(process.env.PORT || 3000, () => {
    console.log('Сервер запущен');
});
