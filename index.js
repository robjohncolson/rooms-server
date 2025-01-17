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

// Store connected users with timestamps and scores
const users = new Map();
const scores = new Map();

// Log current user count
const logUserCount = () => {
  console.log(`Current user count: ${users.size}`);
  console.log('Active users:', Array.from(users.values()).map(u => u.user.name));
};

// Clean up disconnected users periodically
setInterval(() => {
  const now = Date.now();
  for (const [socketId, userData] of users.entries()) {
    if (now - userData.lastSeen > 60000) { // Remove if not seen for 1 minute
      console.log('Cleaning up inactive user:', socketId);
      users.delete(socketId);
      scores.delete(socketId);
      io.emit('user-left', socketId);
      logUserCount();
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
    scores.delete(socket.id);
    io.emit('user-left', socket.id);
  }
  
  // Generate username for the new user
  const username = generateUsername();
  const userData = {
    user: {
      id: socket.id,
      name: username
    },
    lastSeen: Date.now()
  };
  
  users.set(socket.id, userData);
  scores.set(socket.id, []);
  console.log('New user connected:', username);
  logUserCount();
  
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

  // Handle score updates
  socket.on('score-update', ({ userId, accuracy }) => {
    console.log('Score update:', userId, accuracy);
    updateLastSeen();
    
    if (scores.has(userId)) {
      const userScores = scores.get(userId);
      if (userScores.length < 3) { // Only allow 3 attempts
        userScores.push(accuracy);
        scores.set(userId, userScores);
        io.emit('score-update', { userId, accuracy });
        
        // Check if this user has completed their attempts
        if (userScores.length === 3) {
          const avgScore = userScores.reduce((a, b) => a + b, 0) / userScores.length;
          console.log(`User ${userId} completed game with average score: ${avgScore}`);
        }
      }
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
    scores.delete(socket.id);
    io.emit('user-left', socket.id);
    logUserCount();
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 