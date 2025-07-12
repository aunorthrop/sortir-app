const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = 'users.json';
const UPLOADS_DIR = 'uploads';
const SESSIONS = {};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

// Ensure users.json exists
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Storage per user
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const email = req.email;
    const dir = path.join(UPLOADS_DIR, email);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Middleware to get session
app.use((req, res, next) => {
  const sessionId = req.cookies.sessionId;
  req.email = SESSIONS[sessionId];
  next();
});

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  if (users[email]) return res.status(409).send('User already exists');
  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed, resetToken: '', files: [] };
  saveUsers(users);
  res.sendStatus(200);
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users[email];
  if (!user) return res.status(401).send('Invalid credentials');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).send('Invalid credentials');
  const sessionId = uuidv4();
  SESSIONS[sessionId] = email;
  res.cookie('sessionId', sessionId).sendStatus(200);
});

// Logout
app.get('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  delete SESSIONS[sessionId];
  res.clearCookie('sessionId').redirect('/');
});

// Upload
app.post('/upload', upload.single('file'), (req, res) => {
  const users = getUsers();
  const email = req.email;
  const filename = req.file.originalname;
  if (!users[email].files.includes(filename)) users[email].files.push(filename);
  saveUsers(users);
  res.sendStatus(200);
});

// Delete
app.post('/delete', (req, res) => {
  const { filename } = req.body;
  const users = getUsers();
  const email = req.email;
  const filepath = path.join(UPLOADS_DIR, email, filename);
  fs.unlinkSync(filepath);
  users[email].files = users[email].files.filter(f => f !== filename);
  saveUsers(users);
  res.sendStatus(200);
});

// Get file list
app.get('/files', (req, res) => {
  const users = getUsers();
  const email = req.email;
  if (!users[email]) return res.status(403).send([]);
  res.json(users[email].files);
});

// Forgot password
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = getUsers();
  if (!users[email]) return res.status(404).send('Email not found');
  const token = uuidv4();
  users[email].resetToken = token;
  saveUsers(users);

  // Email logic
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'appsortir@gmail.com',
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const link = `https://${req.headers.host}/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;
  const mailOptions = {
    from: 'appsortir@gmail.com',
    to: email,
    subject: 'Reset your Sortir password',
    html: `<p>Click <a href="${link}">here</a> to reset your password.</p>`
  };

  transporter.sendMail(mailOptions, err =>
    err ? res.status(500).send('Error sending email') : res.sendStatus(200)
  );
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = getUsers();
  const user = users[email];
  if (!user || user.resetToken !== token) return res.status(400).send('Invalid token');
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  user.resetToken = '';
  saveUsers(users);
  res.sendStatus(200);
});

// Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
