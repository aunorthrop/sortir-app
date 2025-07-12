const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Load or initialize user data
const USERS_FILE = 'users.json';
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Email sender setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'appsortir@gmail.com',
    pass: process.env.GMAIL_PASSWORD
  }
});

// Multer config for per-user directories
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userDir = path.join(__dirname, 'uploads', req.sessionEmail);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// --- Session Management (simplified)
const sessions = {};

function createSession(email) {
  const sessionId = uuidv4();
  sessions[sessionId] = email;
  return sessionId;
}

function getEmailFromSession(req) {
  const sessionId = req.headers.cookie?.split('=')[1];
  return sessions[sessionId];
}

// --- Routes ---

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (users[email]) return res.status(400).send('User already exists.');
  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed, resetToken: '', files: [] };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.sendStatus(200);
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send('Invalid credentials.');
  }
  const sessionId = createSession(email);
  res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly`);
  res.sendStatus(200);
});

// Upload file
app.post('/upload', upload.single('file'), (req, res) => {
  const email = getEmailFromSession(req);
  if (!email) return res.sendStatus(403);
  users[email].files.push(req.file.originalname);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.redirect('/vault.html');
});

// Get files
app.get('/files', (req, res) => {
  const email = getEmailFromSession(req);
  if (!email) return res.sendStatus(403);
  res.json(users[email].files || []);
});

// Delete file
app.post('/delete-file', (req, res) => {
  const email = getEmailFromSession(req);
  if (!email) return res.sendStatus(403);
  const { filename } = req.body;
  const userDir = path.join(__dirname, 'uploads', email);
  const filePath = path.join(userDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  users[email].files = users[email].files.filter(f => f !== filename);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.sendStatus(200);
});

// Send reset email
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!users[email]) return res.status(404).send('Email not found');
  const token = uuidv4();
  users[email].resetToken = token;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
  transporter.sendMail({
    to: email,
    subject: 'Sortir Password Reset',
    text: `Reset your password: ${resetLink}`
  }, (err) => {
    if (err) return res.status(500).send('Email failed');
    res.sendStatus(200);
  });
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const user = Object.entries(users).find(([_, val]) => val.resetToken === token);
  if (!user) return res.status(400).send('Invalid token');
  const [email] = user;
  users[email].password = await bcrypt.hash(newPassword, 10);
  users[email].resetToken = '';
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.sendStatus(200);
});

// Logout
app.get('/logout', (req, res) => {
  const sessionId = req.headers.cookie?.split('=')[1];
  delete sessions[sessionId];
  res.setHeader('Set-Cookie', 'session=; Max-Age=0');
  res.redirect('/');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
