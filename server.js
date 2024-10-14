const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let users = [];

io.on('connection', (socket) => {
    socket.on('user-joined', (username) => {
        users.push(username);
        socket.username = username;
        io.emit('update-users', users);
    });

    socket.on('disconnect', () => {
        users = users.filter((user) => user !== socket.username);
        io.emit('update-users', users);
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
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Сервер запущен');
});
