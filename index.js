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
  // Generate username and initial color
  const username = generateUsername();
  const user = {
    id: socket.id,
    name: username,
    color: { c: 0, m: 0, y: 0, k: 0 }
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
      socket.broadcast.emit('user-updated', user);
    }
  });

  // Handle flash events
  socket.on('flash', (userId) => {
    io.emit('user-flash', userId);
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