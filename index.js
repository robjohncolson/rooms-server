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
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Store connected users with timestamps
const users = new Map();

// Clean up disconnected users periodically
setInterval(() => {
  const now = Date.now();
  for (const [socketId, userData] of users.entries()) {
    if (now - userData.lastSeen > 60000) { // Remove if not seen for 1 minute
      console.log('Cleaning up inactive user:', socketId);
      users.delete(socketId);
      io.emit('user-left', socketId);
    }
  }
}, 30000);

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Clean up any existing user with this ID
  if (users.has(socket.id)) {
    const oldUser = users.get(socket.id);
    console.log('Cleaning up existing user:', socket.id);
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  }
  
  // Generate username and initial color with some default color
  const username = generateUsername();
  const userData = {
    user: {
      id: socket.id,
      name: username,
      color: { c: 50, m: 50, y: 50, k: 0 }
    },
    lastSeen: Date.now()
  };
  
  users.set(socket.id, userData);
  
  // Send initial user data
  socket.emit('init', {
    user: userData.user,
    users: Array.from(users.values()).map(u => u.user)
  });
  
  // Broadcast new user to others
  socket.broadcast.emit('user-joined', userData.user);

  // Update last seen on any event
  const updateLastSeen = () => {
    if (users.has(socket.id)) {
      users.get(socket.id).lastSeen = Date.now();
    }
  };

  // Handle color changes
  socket.on('color-change', (color) => {
    console.log('Color change:', socket.id, color);
    updateLastSeen();
    if (users.has(socket.id)) {
      const userData = users.get(socket.id);
      userData.user.color = color;
      users.set(socket.id, userData);
      io.emit('user-updated', userData.user);
    }
  });

  // Handle flash events
  socket.on('flash', (userId) => {
    console.log('Flash event:', userId);
    updateLastSeen();
    if (users.has(userId)) {
      io.emit('user-flash', userId);
    }
  });

  // Handle pings to keep connection alive
  socket.on('ping', () => {
    updateLastSeen();
    socket.emit('pong');
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