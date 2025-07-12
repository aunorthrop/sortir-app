const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = 'users.json';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(
  session({
    secret: 'sortirSecret',
    resave: false,
    saveUninitialized: true,
  })
);

// Load users
function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Signup
app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(400).send('Email already registered.');

  users[email] = { password };
  saveUsers(users);
  req.session.user = email;
  res.sendStatus(200);
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]?.password === password) {
    req.session.user = email;
    res.sendStatus(200);
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Forgot Password
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.status(404).send('Email not found');

  const token = crypto.randomBytes(20).toString('hex');
  users[email].resetToken = token;
  saveUsers(users);

  const resetLink = `https://${req.headers.host}/reset-password.html?token=${token}&email=${email}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Sortir Password Reset',
    text: `Click the link to reset your password: ${resetLink}`,
  };

  transporter.sendMail(mailOptions, err => {
    if (err) {
      console.error('Email error:', err);
      res.status(500).send('Failed to send reset link.');
    } else {
      res.sendStatus(200);
    }
  });
});

// Reset password
app.post('/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();

  if (users[email]?.resetToken === token) {
    users[email].password = newPassword;
    delete users[email].resetToken;
    saveUsers(users);
    res.sendStatus(200);
  } else {
    res.status(400).send('Invalid or expired token');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => {
  console.log(`Sortir app running at http://localhost:${PORT}`);
});
