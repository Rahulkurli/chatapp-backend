// models/BroadcastMessage.js
const mongoose = require("mongoose");

const broadcastMessageSchema = new mongoose.Schema({
  senderName: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BroadcastMessage", broadcastMessageSchema);
