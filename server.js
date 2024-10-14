const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://pic-nic.vercel.app", // Укажите URL вашего клиента
        methods: ["GET", "POST"],
        allowedHeaders: ["pic.nic"],
        credentials: true,
    },
});

app.use(cors()); // Включаем CORS для всех запросов
app.use(express.static('public'));

let users = [];
let privateChats = {};

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        if (!users.includes(username)) {
            users.push(username);
            socket.username = username;
            io.emit('update-users', users);
        } else {
            socket.emit('name-taken', username); // Уведомление, если имя занято
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

    // WebRTC обработка
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

// Запуск сервера
server.listen(process.env.PORT || 3000, () => {
    console.log('Сервер запущен');
});
