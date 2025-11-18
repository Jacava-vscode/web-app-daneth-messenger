const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  recipient: { type: String, required: false },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  content: { type: String, required: true },
  status: { type: String, enum: ['sent','delivered','read'], default: 'sent' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
