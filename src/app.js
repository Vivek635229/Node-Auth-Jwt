const express = require("express");
const path = require("path");
const hbs = require("hbs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const cookie = require("cookie-parser");
const app = express();
require("./db/conn");

const port = process.env.PORT || 1000;
const JWT_SECRET =
  process.env.JWT_SECRET || "mynamevivekKharavjefjjojjjatyanhihherHdjhf";
const RESET_TOKEN_SECRET =
  process.env.RESET_TOKEN_SECRET ||
  "mynamevivekKharavjefjjojjjatyanhihherHdjhf";

// path setup
const static_path = path.join(__dirname, "../public");
const template_path = path.join(__dirname, "../templates/views");
const partials_path = path.join(__dirname, "../templates/partials");
app.use(cookie());
app.use(express.static(static_path));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "hbs");
app.set("views", template_path);
hbs.registerPartials(partials_path);

const FLASH_MESSAGES = {
  "login-success": { message: "Successfully logged in.", type: "success" },
  "logout-success": { message: "Successfully logged out.", type: "success" },
  "signup-success": {
    message: "Account created successfully.",
    type: "success",
  },
  "password-reset-success": {
    message: "Password reset successfully. Please login.",
    type: "success",
  },
  "invalid-login": { message: "Invalid login details.", type: "error" },
  "password-not-match": {
    message: "Password and confirm password do not match.",
    type: "error",
  },
  "signup-failed": {
    message: "Signup failed. Try a different username.",
    type: "error",
  },
  "reset-invalid": {
    message: "Reset link is invalid or expired.",
    type: "error",
  },
  "reset-failed": {
    message: "Could not reset password.",
    type: "error",
  },
  "auth-required": {
    message: "Please login first to access dashboard.",
    type: "error",
  },
};

const getFlash = (req) => {
  const flashKey = req.query.flash;
  return FLASH_MESSAGES[flashKey] || { message: null, type: null };
};

const getCurrentUser = async (req) => {
  const token = req.cookies.jwt;
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded._id,
      "tokens.token": token,
    });
    return user;
  } catch (error) {
    return null;
  }
};

app.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  const flash = getFlash(req);

  res.render("index", {
    isAuthenticated: Boolean(user),
    username: user ? user.username : "Guest",
    flashMessage: flash.message,
    flashType: flash.type,
  });
});

app.get("/about", async (req, res) => {
  const user = await getCurrentUser(req);
  const flash = getFlash(req);

  if (!user) {
    return res.redirect("/signin?flash=auth-required");
  }

  res.render("about", {
    isAuthenticated: true,
    username: user.username,
    flashMessage: flash.message,
    flashType: flash.type,
  });
});

app.get("/signup", (req, res) => {
  const flash = getFlash(req);
  res.render("signup", {
    flashMessage: flash.message,
    flashType: flash.type,
  });
});

app.post("/signup", async (req, res) => {
  try {
    const password = req.body.password;
    const cpassword = req.body.confirmPassword;

    if (password === cpassword) {
      const data = new User({
        username: req.body.username,
        password: password,
      });

      const token = await data.generateAuthToken();
      res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });

      res.status(201).redirect("/?flash=signup-success");
    } else {
      res.status(400).redirect("/signup?flash=password-not-match");
    }
  } catch (error) {
    res.status(400).redirect("/signup?flash=signup-failed");
  }
});

app.get("/signin", (req, res) => {
  const flash = getFlash(req);
  res.render("signin", {
    flashMessage: flash.message,
    flashType: flash.type,
  });
});

app.post("/signin", async (req, res) => {
  try {
    const password = req.body.password;
    const username = req.body.username;
    const userdata = await User.findOne({ username: username });
    if (!userdata) {
      return res.status(400).redirect("/signin?flash=invalid-login");
    }

    const matchpassword = await bcrypt.compare(password, userdata.password);
    if (matchpassword) {
      const token = await userdata.generateAuthToken();
      res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });

      res.status(200).redirect("/?flash=login-success");
    } else {
      res.status(400).redirect("/signin?flash=invalid-login");
    }
  } catch (error) {
    res.status(400).redirect("/signin?flash=invalid-login");
  }
});

app.get("/logout", async (req, res) => {
  const token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded._id);
      if (user) {
        user.tokens = user.tokens.filter((entry) => entry.token !== token);
        await user.save();
      }
    } catch (error) {
      // Ignore token failures and clear cookie anyway.
    }
  }

  res.clearCookie("jwt");
  res.redirect("/?flash=logout-success");
});

app.get("/forgot-password", (req, res) => {
  const flash = getFlash(req);
  res.render("forgot-password", {
    flashMessage: flash.message,
    flashType: flash.type,
    resetLink: null,
  });
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username: username });

    if (!user) {
      return res.render("forgot-password", {
        flashMessage: "Username not found.",
        flashType: "error",
        resetLink: null,
      });
    }

    const resetToken = await user.generatePasswordResetToken();
    const resetLink = `${req.protocol}://${req.get(
      "host",
    )}/reset-password/${resetToken}`;

    res.render("forgot-password", {
      flashMessage: "Password reset link generated.",
      flashType: "success",
      resetLink,
    });
  } catch (error) {
    res.status(400).render("forgot-password", {
      flashMessage: "Unable to generate reset link. Try again.",
      flashType: "error",
      resetLink: null,
    });
  }
});

app.get("/reset-password/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const decoded = jwt.verify(token, RESET_TOKEN_SECRET);

    const user = await User.findOne({
      _id: decoded._id,
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).redirect("/signin?flash=reset-invalid");
    }

    const flash = getFlash(req);
    res.render("reset-password", {
      resetToken: token,
      flashMessage: flash.message,
      flashType: flash.type,
    });
  } catch (error) {
    res.status(400).redirect("/signin?flash=reset-invalid");
  }
});

app.post("/reset-password/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const { password } = req.body;
    const decoded = jwt.verify(token, RESET_TOKEN_SECRET);

    const user = await User.findOne({
      _id: decoded._id,
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).redirect("/signin?flash=reset-invalid");
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.redirect("/signin?flash=password-reset-success");
  } catch (error) {
    res
      .status(400)
      .redirect(`/reset-password/${req.params.token}?flash=reset-failed`);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
