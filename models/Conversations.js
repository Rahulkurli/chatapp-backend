const mongoose = require("mongoose");

const conversationSchema = mongoose.Schema({
  members: {
    type: Array,
    required: true,
    createdAt: { type: Date, default: Date.now },
  },
});

const Conversations = mongoose.model("conversation", conversationSchema);

module.exports = Conversations;
