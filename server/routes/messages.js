const express = require('express');
const Message = require('../models/Message');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Protected: return messages (limited to authenticated callers)
// Optional query `with=<username_or_id>` to fetch messages between current user and that username or id
router.get('/messages', authenticate, async (req, res) => {
  try {
    const meUsername = req.user && req.user.username
    const meId = req.user && req.user.id
    const otherParam = req.query.with
    let filter = {}

    if (meId && otherParam) {
      // try interpret otherParam as an ObjectId first
      let otherId = null
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(otherParam)
      if (isObjectId) otherId = otherParam
      else {
        const otherUser = await require('../models/User').findOne({ username: otherParam }).select('_id')
        if (otherUser) otherId = otherUser._id
      }

      if (otherId) {
        filter = { $or: [ { senderId: meId, recipientId: otherId }, { senderId: otherId, recipientId: meId } ] }
      } else {
        // fallback to username-based filter
        filter = { $or: [ { sender: meUsername, recipient: otherParam }, { sender: otherParam, recipient: meUsername } ] }
      }
    }

    const msgs = await Message.find(filter).sort({ timestamp: 1 }).limit(1000)
    res.json(msgs)
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message })
  }
})

// POST /api/messages - create a message (protected)
router.post('/messages', authenticate, async (req, res) => {
  try {
    const sender = req.user && req.user.username ? req.user.username : req.body.sender
    const senderId = req.user && req.user.id ? req.user.id : null
    const { recipient, recipientId, content } = req.body
    if (!content) return res.status(400).json({ error: 'Missing content' })

    let resolvedRecipientId = recipientId || null
    let resolvedRecipient = recipient || null
    if (recipient && !resolvedRecipientId) {
      const other = await require('../models/User').findOne({ username: recipient }).select('_id username')
      if (other) {
        resolvedRecipientId = other._id
        resolvedRecipient = other.username
      }
    }

    const msg = new Message({ sender, senderId: senderId || undefined, recipient: resolvedRecipient || null, recipientId: resolvedRecipientId || undefined, content, timestamp: new Date() })
    await msg.save()

    // attempt targeted emit via io & onlineUsers map
    const io = req.app && req.app.get('io')
    const onlineUsers = req.app && req.app.get('onlineUsers')
    if (io) {
      // always emit to sender socket if available
      if (senderId && onlineUsers && onlineUsers.has(String(senderId))) {
        io.to(onlineUsers.get(String(senderId))).emit('new_message', msg)
      }

      if (resolvedRecipientId && onlineUsers && onlineUsers.has(String(resolvedRecipientId))) {
        const recipSocketId = onlineUsers.get(String(resolvedRecipientId))
        io.to(recipSocketId).emit('new_message', msg)

        // update db status -> delivered
        msg.status = 'delivered'
        await msg.save()

        // notify status
        if (senderId && onlineUsers && onlineUsers.has(String(senderId))) {
          io.to(onlineUsers.get(String(senderId))).emit('message_status', { messageId: msg._id, status: msg.status })
        }
        io.to(recipSocketId).emit('message_status', { messageId: msg._id, status: msg.status })
      } else {
        // fallback: broadcast
        io.emit('new_message', msg)
      }
    }

    res.json(msg)
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message })
  }
})

module.exports = router;
