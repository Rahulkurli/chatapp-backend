const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
