const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://7dedf1ed-3446-41ae-8831-f90ab714ab06-00-3v4y6ihn73rfl.pike.replit.dev", // Укажите URL вашего клиента
        methods: ["GET", "POST"],
        allowedHeaders: ["pic.nic"],
        credentials: true,
    },
});

app.use(cors()); // Включаем CORS для всех запросов
app.use(express.static('public'));

let users = [];

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        if (!users.includes(username)) {
            users.push(username);
            socket.username = username;
            io.emit('update-users', users);
            // Уведомление всех пользователей о новом подключении
            socket.broadcast.emit('chat-message', { from: 'Система', msg: `${username} присоединился к чату.` });
        } else {
            socket.emit('name-taken', username); // Уведомление, если имя занято
        }
    });

    socket.on('chat-message', (msg) => {
        socket.broadcast.emit('chat-message', msg); // Отправляем в общий чат
    });

    socket.on('disconnect', () => {
        users = users.filter((user) => user !== socket.username);
        io.emit('update-users', users);
        // Уведомление всех пользователей о отключении
        socket.broadcast.emit('chat-message', { from: 'Система', msg: `${socket.username} вышел из чата.` });
    });
});

// Запуск сервера
server.listen(process.env.PORT || 3000, () => {
    console.log('Сервер запущен');
});
