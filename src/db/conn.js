require("dotenv").config();
const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.set("strictQuery", false);
mongoose.connect("mongodb://127.0.0.1:27017/Website-register", {
  useNewUrlParser: true,
});
const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});
