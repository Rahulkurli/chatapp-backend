const mongoose = require("mongoose");
const { v2 } = require("cloudinary");

const url = `mongodb+srv://rahulkurli:8847668572Rahul@cluster0.r97lgpa.mongodb.net/?retryWrites=true&w=majority`;

mongoose
  .connect(url, {
    useNewUrlParser: true,
  })
  .then(() => console.log("Connected to db"))
  .catch((e) => console.log("Error connecting to db ", e));

v2.config({
  cloud_name: "rahuldemo",
  api_key: "446221291756375",
  api_secret: "pa-gcJii-hgwntJ8n2mI10P34Nw",
});
