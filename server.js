const express = require('express');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = 'users.json';
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUserFolder(email) {
  return path.join(__dirname, 'uploads', email.replace(/[^a-zA-Z0-9]/g, '_'));
}

app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  if (users.find(user => user.email === email)) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }
  users.push({ email, password });
  writeUsers(users);
  const userFolder = getUserFolder(email);
  fs.mkdirSync(userFolder, { recursive: true });
  req.session.user = email;
  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    req.session.user = email;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

const resetTokens = {};

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, message: 'Email not found' });

  const token = crypto.randomBytes(20).toString('hex');
  resetTokens[token] = email;

  const resetLink = `https://${req.headers.host}/reset-password.html?token=${token}`;

  const mailOptions = {
    from: 'appsortir@gmail.com',
    to: email,
    subject: 'Sortir Password Reset',
    text: `Click to reset your password: ${resetLink}`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }
    res.json({ success: true });
  });
});

app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const email = resetTokens[token];
  if (!email) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (user) {
    user.password = newPassword;
    writeUsers(users);
    delete resetTokens[token];
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Sortir server running on port ${PORT}`);
});
