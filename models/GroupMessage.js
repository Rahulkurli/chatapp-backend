const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const groupMessage = mongoose.model("GroupMessage", messageSchema);
module.exports = groupMessage;
