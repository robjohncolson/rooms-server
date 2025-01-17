import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { generateUsername } from './utils/nameGenerator.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    transports: ['websocket', 'polling']
  },
  allowEIO3: true
});

// Store connected users
const users = new Map();

io.on('connection', (socket) => {
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
    if (users.has(socket.id)) {
      const user = users.get(socket.id);
      user.color = color;
      users.set(socket.id, user);
      io.emit('user-updated', user); // Broadcast to everyone including sender
    }
  });

  // Handle flash events - now flashing other users
  socket.on('flash', (userId) => {
    if (users.has(userId)) {
      io.emit('user-flash', userId);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 