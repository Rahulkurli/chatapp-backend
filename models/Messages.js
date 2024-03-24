const mongoose = require("mongoose");

const messagesSchema = mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
  },
  senderId: {
    type: String,
  },
  message: {
    type: String,
  },
  mediaUrl: {
    type: String,
  },
  isImage: {
    type: Boolean,
  },
  isVideo: {
    type: Boolean,
  },
  createdAt: { type: Date, default: Date.now },
});

const Messages = mongoose.model("Message", messagesSchema);

module.exports = Messages;
