const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();

// Загрузка SSL сертификатов
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Создаем HTTPS сервер
const server = https.createServer(options, app);
const io = socketIo(server);

app.use(express.static('public'));

let users = [];

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        socket.username = username;
        if (!users.includes(username)) {
            users.push(username);
        }
        io.emit('update-users', users);
    });

    socket.on('chat-message', (msg) => {
        socket.broadcast.emit('chat-message', msg);
    });

    socket.on('private-message', (data) => {
        socket.to(data.to).emit('private-message', { from: socket.username, msg: data.msg });
        socket.to(data.to).emit('chat-open', { from: socket.username });
    });

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
        users = users.filter(user => user !== socket.username);
        io.emit('update-users', users);
    });
});

// Запуск сервера на порту 3000
server.listen(3000, () => {
    console.log('Сервер запущен на https://localhost:3000');
});
