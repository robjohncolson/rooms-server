import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { generateUsername } from './utils/nameGenerator.js';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
    transports: ['websocket', 'polling']
  },
  allowEIO3: true,
  pingTimeout: 10000,
  pingInterval: 5000
});

// Store connected users
const users = new Map();

// Clean up disconnected users periodically
setInterval(() => {
  for (const [socketId, user] of users.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      users.delete(socketId);
      io.emit('user-left', socketId);
    }
  }
}, 10000);

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Clean up any existing user with this ID
  if (users.has(socket.id)) {
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  }
  
  // Generate username and initial color with some default color
  const username = generateUsername();
  const user = {
    id: socket.id,
    name: username,
    color: { c: 50, m: 50, y: 50, k: 0 } // Start with a visible color
  };
  
  users.set(socket.id, user);
  
  // Send initial user data
  socket.emit('init', {
    user,
    users: Array.from(users.values())
  });
  
  // Broadcast new user to others
  socket.broadcast.emit('user-joined', user);

  // Handle color changes
  socket.on('color-change', (color) => {
    console.log('Color change:', socket.id, color);
    if (users.has(socket.id)) {
      const user = users.get(socket.id);
      user.color = color;
      users.set(socket.id, user);
      io.emit('user-updated', user); // Broadcast to everyone including sender
    }
  });

  // Handle flash events - now flashing other users
  socket.on('flash', (userId) => {
    console.log('Flash event:', userId);
    if (users.has(userId)) {
      io.emit('user-flash', userId);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Disconnection:', socket.id);
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 