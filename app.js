const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const fs = require("fs");
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  },
});
const multer = require("multer");
// Serve static files from the 'uploads' directory
app.use("/uploads", express.static("uploads"));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now()}_${file.originalname}`);
  },
});
const upload = multer({ storage });
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: "rahuldemo",
  api_key: "446221291756375",
  api_secret: "pa-gcJii-hgwntJ8n2mI10P34Nw",
});

const activeTypingUsers = {};

//Socket.io
const groupSockets = {}; // Keep track of sockets for each group

let users = [];
var broadcastUsers = 0;
const groups = {};
io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  // Handle sending broadcast messages
  socket.on("broadcast", (message) => {
    // Broadcast the message to all connected clients except the sender
    socket.broadcast.emit("broadcastMessage", message);
  });
  // typing...

  socket.on("typing", (userId, conversationId, receiverId) => {
    activeTypingUsers[conversationId] = userId;
    // Emit a "userTyping" event to inform the recipient client about the typing user
    io.emit("userTyping", { userId, conversationId, receiverId });
  });

  socket.on("stopTyping", (userId, conversationId, receiverId) => {
    if (activeTypingUsers[conversationId]) {
      delete activeTypingUsers[conversationId];
    }
    // Emit a "userStoppedTyping" event to inform the recipient client that typing has stopped
    io.emit("userStoppedTyping", { userId, conversationId, receiverId });
  });

  // add conversation
  socket.on("addUser", (userId) => {
    const isUserExist = users.find((user) => user.userId === userId);
    if (!isUserExist) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit("getUsers", users);
    }
  });

  socket.on("sendImage", (formData) => {
    upload.single("image")(formData, null, async (error) => {
      if (error) {
        console.error("Error uploading image:", error);
        return;
      }
    });
  });

  // socket send message & get message
  socket.on(
    "sendMessage",
    async ({ senderId, receiverId, message, conversationId }) => {
      const receiver = users.find((user) => user.userId === receiverId);
      const sender = users.find((user) => user.userId === senderId);
      const user = await Users.findById(senderId);
      if (receiver) {
        io.to(receiver.socketId)
          .to(sender.socketId)
          .emit("getMessage", {
            senderId,
            message,
            conversationId,
            receiverId,
            user: { id: user._id, fullName: user.fullName, email: user.email },
          });
      } else {
        io.to(sender.socketId).emit("getMessage", {
          senderId,
          message,
          conversationId,
          receiverId,
          user: { id: user._id, fullName: user.fullName, email: user.email },
        });
      }
    }
  );

  // Handle group messaging
  socket.on("sendGroupMessage", (data) => {
    const { groupId, sender, text } = data;
    io.emit("getGroupMessage", data);
  });

  //socket disconnect user
  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

// Connect DB
require("./db/connection");

//import files
const Users = require("./models/Users");
const Messages = require("./models/Messages");
const CONVERSATIONS = require("./models/Conversations");
const BroadcastMessage = require("./models/Broadcast");
const Group = require("./models/Group");
const GroupMessage = require("./models/GroupMessage");

// APP USE
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// PORT
const port = process.env.PORT || 8000;

// Routes
app.get("/", (req, res) => {
  res.send("Welcome!");
});

// New user register api

app.post("/api/register", async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      res.status(400).send("Please fill all required fields");
    } else {
      const isAlreadyExist = await Users.findOne({ email });
      if (isAlreadyExist) {
        res.status(400).send("User Already exist ");
      } else {
        const newUser = new Users({ fullName, email });
        bcryptjs.hash(password, 10, (err, hashedPassword) => {
          newUser.set("password", hashedPassword);
          newUser.save();
          next();
        });
        return res.status(200).send("User registered successfully!");
      }
    }
  } catch (err) {
    console.log("Error", err);
  }
});

// user Login Api

app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).send("please fill out all required fields");
    } else {
      const user = await Users.findOne({ email });
      if (!user) {
        res.status(400).send("User Email or password is incorrect!");
      } else {
        const validateUser = await bcryptjs.compare(password, user.password);
        if (!validateUser) {
          res.status(400).send("User Email or password is incorrect!");
        } else {
          const payload = {
            userId: user._id,
            email: user.email,
          };
          const JWT_SECRET_KEY =
            process.env.JWT_SECRET_KEY || "THIS_IS_A_JWT_SECRET_KEY";
          jwt.sign(
            payload,
            JWT_SECRET_KEY,
            { expiresIn: 84600 },
            async (err, token) => {
              await Users.updateOne(
                { _id: user._id },
                {
                  $set: {
                    token,
                  },
                }
              );
              user.save();
              return res.status(200).json({
                user: {
                  id: user._id,
                  email: user.email,
                  fullName: user.fullName,
                },
                token,
              });
            }
          );
        }
      }
    }
  } catch (err) {
    console.log("Error", err);
  }
});

// conversation post  Api

app.post("/api/conversation", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    const newConversation = new CONVERSATIONS({
      members: [senderId, receiverId],
    });
    await newConversation.save();
    res.status(200).send("conversations created successfully!");
  } catch (err) {
    console.log("Error", err);
  }
});

// conversation get api (get receiver details )

app.get("/api/conversation/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await CONVERSATIONS.find({
      members: { $in: [userId] },
    });
    const conversationUserData = Promise.all(
      conversations.map(async (conversation) => {
        const receiverId = conversation.members.find(
          (member) => member !== userId
        );
        const user = await Users.findById(receiverId);
        if (user) {
          return {
            user: {
              receiverId: user._id,
              email: user.email,
              fullName: user.fullName,
            },
            conversationId: conversation._id,
          };
        } else {
          return null;
        }
      })
    );
    res.status(200).json(await conversationUserData);
  } catch (err) {
    console.log("Error", err);
  }
});

// Message send api (POST)
app.post("/api/message", async (req, res) => {
  try {
    const { conversationId, senderId, message, receiverId = "" } = req.body;
    console.log("message", message);
    if (!senderId || !message)
      return res.status(400).send("Please fill out all fields");
    if (conversationId === "new" && receiverId) {
      const newConversation = new CONVERSATIONS({
        members: [senderId, receiverId],
      });
      await newConversation.save();
      const newMessage = new Messages({
        conversationId: newConversation._id,
        senderId,
        message,
      });
      await newMessage.save();
      return res.status(200).send("Message send successfully!");
    } else if (!conversationId && !receiverId) {
      return res.status(400).send("Please Fill out all fields!");
    }

    const newMessage = new Messages({ conversationId, senderId, message });
    await newMessage.save();
    res.status(200).send("Message Send successfully!");
  } catch (err) {
    console.log("Error", err);
  }
});

//Message Receiver api (GET)
app.get("/api/message/:conversationId", async (req, res) => {
  try {
    const checkMessages = async (conversationId) => {
      const messages = await Messages.find({ conversationId });
      const messageUserData = Promise.all(
        messages.map(async (message) => {
          const user = await Users.findById(message.senderId);
          return {
            user: { id: user._id, email: user.email, fullName: user.fullName },
            message: message.message,
          };
        })
      );
      res.status(200).json(await messageUserData);
    };

    const conversationId = req.params.conversationId;
    if (conversationId === "new") {
      const checkConversation = await CONVERSATIONS.find({
        members: { $all: [req.query.senderId, req.query.receiverId] },
      });
      if (checkConversation.length > 0) {
        checkMessages(checkConversation[0]._id);
      } else {
        return res.status(200).json([]);
      }
    } else {
      checkMessages(conversationId);
    }
  } catch (err) {
    console.log("Error", err);
  }
});

// get all users
app.get("/api/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const users = await Users.find({ _id: { $ne: userId } });
    const usersData = Promise.all(
      users.map(async (user) => {
        return {
          user: {
            receiverId: user._id,
            email: user.email,
            fullName: user.fullName,
          },
        };
      })
    );
    res.status(200).json(await usersData);
  } catch (err) {
    console.log("Error", err);
  }
});

// Attachment upload
// Handle media (image or video) upload
app.post("/api/upload", upload.single("media"), (req, res) => {
  try {
    const media = req.file; // Use req.file to access the uploaded file

    if (media) {
      // Construct the media URL and send the response
      const mediaUrl = `/uploads/${media.filename}`;
      res.json({ mediaUrl });
    } else {
      res.status(400).json({ error: "Invalid media file." });
    }
  } catch (error) {
    console.error("Error handling media upload:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// broadcast message
app.post("/api/broadcast", async (req, res) => {
  try {
    const { senderName, message } = req.body;

    // Create a new BroadcastMessage document
    const broadcastMessage = new BroadcastMessage({
      senderName,
      message,
    });

    // Save it to the database
    await broadcastMessage.save();

    res.status(201).send("Broadcast message stored successfully");
  } catch (error) {
    console.error("Error storing broadcast message:", error);
    res.status(500).send("Error storing broadcast message");
  }
});

app.get("/api/broadcast", async (req, res) => {
  const broadcastMessages = await BroadcastMessage.find();

  res.json({ messages: broadcastMessages });
});

// APIs For Groups =============================================================================================

// get groups
app.get("/api/groups/:userId", async (req, res) => {
  try {
    const userId = req.params.userId; // Extract user ID from the URL parameter

    // Find all groups where the user is a member
    const groups = await Group.find({ members: userId }).populate("members");

    res.status(200).json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve groups for the user." });
  }
});

// create group
app.post("/api/groups", async (req, res) => {
  try {
    const { name, admin, members } = req.body;

    // Check if a group with the same name already exists
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ error: "Group name already exists." });
    }

    // Create a new group
    const newGroup = new Group({
      name,
      admin,
      members,
    });

    // Save the group to the database
    const savedGroup = await newGroup.save();
    res.status(201).json(savedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create the group." });
  }
});

// Route to add a member to a group
app.post("/api/groups/:groupId/members", async (req, res) => {
  try {
    const { memberId } = req.body;
    const groupId = req.params.groupId;

    // Find the group by ID
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    // Add the member to the group's members array
    group.members.push(memberId);

    // Save the group with the updated members array
    const savedGroup = await group.save();

    res.status(200).json(savedGroup);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ error: "Failed to add a member to the group." });
  }
});

// Route to remove existing user from the group
app.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const memberId = req.params.memberId;

    // Find the group by ID
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    // Check if the member exists in the group
    const memberIndex = group.members.indexOf(memberId);

    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member not found in the group." });
    }

    // Remove the member from the group's members array
    group.members.splice(memberIndex, 1);

    // Save the group with the updated members array
    const savedGroup = await group.save();

    res.status(200).json(savedGroup);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res
      .status(500)
      .json({ error: "Failed to remove a member from the group." });
  }
});

// Route to get group details
app.get("/api/groups/:groupId", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ error: "Failed to get group details." });
  }
});

// send a message in a group
app.post("/api/groups/:groupId/GroupMessage", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const { sender, text } = req.body;

    // Create a new group message
    const newGroupMessage = new GroupMessage({ group: groupId, sender, text });
    const savedMessage = await newGroupMessage.save();

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ error: "Failed to send the group message." });
  }
});

// get messages from the group
app.get("/api/groups/:groupId/GroupMessage", async (req, res) => {
  {
    try {
      const groupId = req.params.groupId;

      // Find the group by ID
      const group = await Group.findById(groupId);

      if (!group) {
        return res.status(404).json({ error: "Group not found." });
      }

      // Retrieve messages for the group
      const messages = await GroupMessage.find({ group: groupId });

      res.status(200).json(messages);
    } catch (error) {
      console.error(error); // Log the error for debugging
      res
        .status(500)
        .json({ error: "Failed to retrieve messages for the group." });
    }
  }
});

// port listen =======================================================================

server.listen(port, () => {
  console.log("listening on " + port);
});
