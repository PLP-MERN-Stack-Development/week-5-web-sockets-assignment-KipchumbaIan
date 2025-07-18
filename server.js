const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10 MB max file size
});

const users = {};
const typingUsers = new Set();
const messages = [];

io.on('connection', (socket) => {
  console.log('a user connected');
  
  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    socket.broadcast.emit('userConnected', username);
    io.emit('updateUserList', Object.values(users));
  });

  socket.on('chatMessage', (msg) => {
    const username = users[socket.id];
    const messageData = { 
      id: Date.now().toString(),
      user: username, 
      text: msg,
      time: new Date().toLocaleTimeString(),
      reactions: {}
    };
    messages.push(messageData);
    io.emit('message', messageData);
  });

  socket.on('fileMessage', ({ file, fileType, fileName }) => {
    const username = users[socket.id];
    const messageData = {
      id: Date.now().toString(),
      user: username,
      fileUrl: file,
      fileType,
      fileName,
      time: new Date().toLocaleTimeString(),
      reactions: {}
    };
    messages.push(messageData);
    io.emit('message', messageData);
  });

  socket.on('addReaction', ({ messageId, reaction }) => {
    const username = users[socket.id];
    const message = messages.find(m => m.id === messageId);
    if (message) {
      if (!message.reactions[reaction]) {
        message.reactions[reaction] = [];
      }
      if (!message.reactions[reaction].includes(username)) {
        message.reactions[reaction].push(username);
        io.emit('messageReaction', { messageId, reactions: message.reactions });
      }
    }
  });

  socket.on('removeReaction', ({ messageId, reaction }) => {
    const username = users[socket.id];
    const message = messages.find(m => m.id === messageId);
    if (message && message.reactions[reaction]) {
      message.reactions[reaction] = message.reactions[reaction].filter(user => user !== username);
      if (message.reactions[reaction].length === 0) {
        delete message.reactions[reaction];
      }
      io.emit('messageReaction', { messageId, reactions: message.reactions });
    }
  });

  socket.on('privateMessage', ({ to, message }) => {
    const fromUser = users[socket.id];
    const toSocketId = Object.keys(users).find(key => users[key] === to);
    
    if (toSocketId) {
      // Send to recipient
      io.to(toSocketId).emit('privateMessage', {
        from: fromUser,
        text: message,
        time: new Date().toLocaleTimeString()
      });
      // Send to sender
      socket.emit('privateMessage', {
        to,
        text: message,
        time: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('typing', (isTyping) => {
    const username = users[socket.id];
    if (isTyping) {
      typingUsers.add(username);
    } else {
      typingUsers.delete(username);
    }
    socket.broadcast.emit('userTyping', Array.from(typingUsers));
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      socket.broadcast.emit('userDisconnected', username);
      delete users[socket.id];
      typingUsers.delete(username);
      io.emit('updateUserList', Object.values(users));
      io.emit('userTyping', Array.from(typingUsers));
    }
    console.log('user disconnected');
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});