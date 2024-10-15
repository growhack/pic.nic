const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://a01899e1-923f-4672-93ca-6bdb4e7326d8-00-2h0q4s1e6a027.sisko.replit.dev/", // Укажите URL вашего клиента
        methods: ["GET", "POST"],
        allowedHeaders: ["pic.nic"],
        credentials: true,
    },
});

app.use(cors());
app.use(express.static('public'));

let users = [];

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        if (!users.includes(username)) {
            users.push(username);
            socket.username = username;
            io.emit('update-users', users);
            socket.broadcast.emit('chat-message', { from: 'Система', msg: `${username} присоединился к чату.` });
        } else {
            socket.emit('name-taken', username);
        }
    });

    socket.on('chat-message', (msg) => {
        socket.broadcast.emit('chat-message', msg); // Убедитесь, что сообщения рассылаются всем, кроме отправителя
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            users = users.filter((user) => user !== socket.username);
            io.emit('update-users', users);
            socket.broadcast.emit('chat-message', { from: 'Система', msg: `${socket.username} вышел из чата.` });
        }
    });
});

// Запуск сервера
server.listen(process.env.PORT || 3000, () => {
    console.log('Сервер запущен');
});
