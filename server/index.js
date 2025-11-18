require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const authRoutes = require('./routes/auth');
const messagesRoutes = require('./routes/messages');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', messagesRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Map userId -> socket.id for online users
const onlineUsers = new Map()

// Socket auth: accept token via handshake auth.token or Authorization header
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token
      ? socket.handshake.auth.token
      : (socket.handshake.headers && socket.handshake.headers.authorization ? socket.handshake.headers.authorization.split(' ')[1] : null)
    if (!token) return next()
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret')
    socket.user = { id: payload.id, username: payload.username, isAdmin: payload.isAdmin }
    return next()
  } catch (err) {
    // don't block connection for failed auth; allow anonymous sockets
    return next()
  }
})

io.on('connection', (socket) => {
  // register online user by id
  if (socket.user && socket.user.id) {
    onlineUsers.set(socket.user.id, socket.id)
  }

  socket.on('send_message', async (data) => {
    try {
      const sender = (socket.user && socket.user.username) || data.sender || 'Unknown'
      const senderId = (socket.user && socket.user.id) || null
      let recipient = data.recipient || null
      let recipientId = data.recipientId || null

      // if recipient provided as username but no recipientId, try to resolve
      if (recipient && !recipientId) {
        const u = await User.findOne({ username: recipient }).select('_id username')
        if (u) recipientId = u._id
      }

      const msg = new Message({ sender, senderId: senderId || undefined, recipient: recipient || null, recipientId: recipientId || undefined, content: data.content, timestamp: new Date() })
      await msg.save()

      // emit to sender
      socket.emit('new_message', msg)

      // deliver to recipient if online (by id)
      if (recipientId && onlineUsers.has(String(recipientId))) {
        const recipientSocketId = onlineUsers.get(String(recipientId))
        io.to(recipientSocketId).emit('new_message', msg)

        // update status to delivered
        msg.status = 'delivered'
        await msg.save()

        // notify both parties about status
        socket.emit('message_status', { messageId: msg._id, status: msg.status })
        io.to(recipientSocketId).emit('message_status', { messageId: msg._id, status: msg.status })
      } else {
        // fallback broadcast to others
        socket.broadcast.emit('new_message', msg)
      }
    } catch (err) {
      console.error('Error saving message:', err)
    }
  })

  socket.on('message_read', async (data) => {
    try {
      const messageId = data && data.messageId
      if (!messageId) return
      const msg = await Message.findById(messageId)
      if (!msg) return
      msg.status = 'read'
      await msg.save()

      // notify sender if online
      const sId = msg.senderId ? String(msg.senderId) : null
      if (sId && onlineUsers.has(sId)) {
        const senderSocketId = onlineUsers.get(sId)
        io.to(senderSocketId).emit('message_status', { messageId: msg._id, status: msg.status })
      }
    } catch (err) {
      console.error('Error handling message_read:', err)
    }
  })

  socket.on('disconnect', () => {
    if (socket.user && socket.user.id) {
      onlineUsers.delete(socket.user.id)
    }
  })
});

// make io and onlineUsers available to express routes (for REST->socket emits)
app.set('io', io)
app.set('onlineUsers', onlineUsers)

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI not set. Set it in .env or environment.');
    } else {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('Connected to MongoDB');
    }

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
}

start();
