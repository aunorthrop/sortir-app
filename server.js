const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = './users.json';
const UPLOADS_DIR = './uploads';

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

// Ensure users.json exists
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');

// Set up nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userFolder = path.join(UPLOADS_DIR, req.session.email);
    fs.mkdirSync(userFolder, { recursive: true });
    cb(null, userFolder);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Routes
app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  if (users[email]) return res.status(400).send('Email already registered');
  users[email] = { password };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  fs.mkdirSync(path.join(UPLOADS_DIR, email), { recursive: true });
  res.status(200).send('Signup successful');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  if (users[email] && users[email].password === password) {
    req.session.email = email;
    res.redirect('/vault.html');
  } else {
    res.status(401).send('Invalid email or password');
  }
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  if (!users[email]) return res.status(404).send('User not found');
  const token = crypto.randomBytes(20).toString('hex');
  users[email].resetToken = token;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  const resetLink = `https://${req.headers.host}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;
  transporter.sendMail({
    to: email,
    subject: 'Sortir Password Reset',
    text: `Click to reset: ${resetLink}`
  }, (err) => {
    if (err) return res.status(500).send('Email failed');
    res.status(200).send('Reset email sent');
  });
});

app.post('/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  if (users[email]?.resetToken === token) {
    users[email].password = newPassword;
    delete users[email].resetToken;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.status(200).send('Password reset');
  } else {
    res.status(400).send('Invalid reset');
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.session.email) return res.status(403).send('Not logged in');
  res.redirect('/vault.html');
});

app.get('/files', (req, res) => {
  const userDir = path.join(UPLOADS_DIR, req.session.email || '');
  if (!fs.existsSync(userDir)) return res.json([]);
  const files = fs.readdirSync(userDir);
  res.json(files);
});

app.post('/delete-file', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.session.email, req.body.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.status(200).send('Deleted');
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
