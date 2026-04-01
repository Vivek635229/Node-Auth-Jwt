require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "mynamevivekKharavjefjjojjjatyanhihherHdjhf";
const RESET_TOKEN_SECRET =
  process.env.RESET_TOKEN_SECRET ||
  "mynamevivekKharavjefjjojjjatyanhihherHdjhf";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  passwordResetToken: {
    type: String,
  },
  passwordResetExpires: {
    type: Date,
  },
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
});
userSchema.methods.generateAuthToken = async function () {
  try {
    const token = jwt.sign({ _id: this._id }, JWT_SECRET, { expiresIn: "7d" });
    this.tokens = this.tokens.concat({ token: token });
    await this.save();
    return token;
  } catch (error) {
    console.log(error);
  }
};

userSchema.methods.generatePasswordResetToken = async function () {
  const resetToken = jwt.sign(
    { _id: this._id, purpose: "password-reset" },
    RESET_TOKEN_SECRET,
    { expiresIn: "15m" },
  );

  this.passwordResetToken = resetToken;
  this.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await this.save();

  return resetToken;
};

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
