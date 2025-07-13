const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USER_DATA_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USER_DATA_FILE)) fs.writeFileSync(USER_DATA_FILE, "{}");

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "sortir_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Load user data
function loadUsers() {
  return JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
}

// Redirect root to login if not authenticated
app.get("/", (req, res) => {
  if (!req.session.email) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Signup route
app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(400).send("Email already exists");
  users[email] = { password, files: [] };
  saveUsers(users);
  req.session.email = email;
  res.redirect("/");
});

// Login route
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].password !== password)
    return res.status(401).send("Invalid credentials");
  req.session.email = email;
  res.redirect("/");
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});

// Upload route
app.post("/upload", (req, res) => {
  const { filename, content } = req.body;
  const email = req.session.email;
  if (!email) return res.status(401).send("Unauthorized");

  const userDir = path.join(DATA_DIR, email);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);

  const filePath = path.join(userDir, filename);
  fs.writeFileSync(filePath, content, "base64");

  const users = loadUsers();
  users[email].files.push(filename);
  saveUsers(users);
  res.sendStatus(200);
});

// Ask route (placeholder for your PDF query logic)
app.post("/ask", (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(401).send("Unauthorized");
  res.send("Answer generated from documents.");
});

// Delete file
app.post("/delete", (req, res) => {
  const email = req.session.email;
  const { filename } = req.body;
  const userDir = path.join(DATA_DIR, email);
  const filePath = path.join(userDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const users = loadUsers();
  users[email].files = users[email].files.filter((f) => f !== filename);
  saveUsers(users);
  res.sendStatus(200);
});

// Forgot Password
app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.status(404).send("User not found");

  const token = crypto.randomBytes(32).toString("hex");
  users[email].resetToken = token;
  saveUsers(users);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "appsortir@gmail.com",
      pass: process.env.GMAIL_PASSWORD,
    },
  });

  const resetUrl = `https://${req.headers.host}/reset-password.html?token=${token}&email=${email}`;
  const mailOptions = {
    from: "Sortir App <appsortir@gmail.com>",
    to: email,
    subject: "Password Reset",
    html: `<p>Click to reset: <a href="${resetUrl}">Reset Password</a></p>`,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) return res.status(500).send("Failed to send reset email");
    res.send("Password reset email sent");
  });
});

// Reset Password
app.post("/reset-password", (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].resetToken !== token)
    return res.status(400).send("Invalid reset attempt");

  users[email].password = newPassword;
  delete users[email].resetToken;
  saveUsers(users);
  res.send("Password updated");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
