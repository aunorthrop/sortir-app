const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

// Storage Setup
const upload = multer({ dest: 'uploads/' });

// Load Users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

// Save Users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users[email]) return res.status(400).send('Email already registered.');

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed, files: [] };
  saveUsers(users);
  res.sendStatus(200);
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users[email];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send('Invalid credentials');
  }

  req.session.email = email;
  res.sendStatus(200);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Upload
app.post('/upload', upload.single('file'), (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(403).send('Not logged in');

  const users = loadUsers();
  users[email].files.push(req.file.originalname);
  saveUsers(users);
  res.sendStatus(200);
});

// Ask
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  res.json({ answer: `Pretend AI answer to "${question}"` });
});

// Request Password Reset
app.post('/request-password-reset', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) return res.status(404).send('User not found');

  const token = uuidv4();
  users[email].resetToken = token;
  saveUsers(users);

  const link = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'appsortir@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const mailOptions = {
    from: 'Sortir <appsortir@gmail.com>',
    to: email,
    subject: 'Reset your Sortir password',
    html: `<p>Click the link below to reset your password:</p><a href="${link}">${link}</a>`
  };

  transporter.sendMail(mailOptions, err => {
    if (err) return res.status(500).send('Email failed to send');
    res.sendStatus(200);
  });
});

// Reset Password
app.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();
  const user = users[email];

  if (!user || user.resetToken !== token) {
    return res.status(400).send('Invalid token');
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  users[email].password = hashed;
  delete users[email].resetToken;
  saveUsers(users);

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
