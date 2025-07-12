const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = 'users.json';
const UPLOADS_DIR = 'uploads';
const RESET_URL_BASE = 'https://sortir-app.onrender.com/reset-password.html?token=';
const SENDER_EMAIL = 'appsortir@gmail.com';
const SENDER_PASS = process.env.EMAIL_PASS;

let sessions = {};
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASS
  }
});

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getEmailFromToken(token) {
  const users = loadUsers();
  return Object.keys(users).find(email => users[email].resetToken === token);
}

function getUserEmail(req) {
  return sessions[req.cookies.session] || null;
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(409).send('User already exists.');
  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed, resetToken: "", files: [] };
  saveUsers(users);
  res.sendStatus(200);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users[email];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send('Invalid credentials');
  }
  const sessionId = uuidv4();
  sessions[sessionId] = email;
  res.cookie('session', sessionId);
  res.sendStatus(200);
});

app.post('/upload', upload.single('file'), (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.redirect('/');
  const users = loadUsers();
  const filename = req.file.originalname;
  const target = path.join(UPLOADS_DIR, email + '-' + filename);
  fs.renameSync(req.file.path, target);
  users[email].files.push(filename);
  saveUsers(users);
  res.redirect('/');
});

app.get('/files', (req, res) => {
  const email = getUserEmail(req);
  if (!email) return res.json([]);
  const users = loadUsers();
  res.json(users[email].files || []);
});

app.post('/delete', (req, res) => {
  const email = getUserEmail(req);
  const filename = req.body.filename;
  if (!email || !filename) return res.sendStatus(400);
  const users = loadUsers();
  const fullPath = path.join(UPLOADS_DIR, email + '-' + filename);
  fs.unlinkSync(fullPath);
  users[email].files = users[email].files.filter(f => f !== filename);
  saveUsers(users);
  res.sendStatus(200);
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.status(404).send('Not found');
  const token = uuidv4();
  users[email].resetToken = token;
  saveUsers(users);

  const resetUrl = `${RESET_URL_BASE}${token}`;
  transporter.sendMail({
    from: SENDER_EMAIL,
    to: email,
    subject: 'Sortir Password Reset',
    html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
  });

  res.sendStatus(200);
});

app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const email = getEmailFromToken(token);
  if (!email) return res.status(400).send('Invalid token');
  const users = loadUsers();
  users[email].password = await bcrypt.hash(password, 10);
  users[email].resetToken = "";
  saveUsers(users);
  res.sendStatus(200);
});

app.get('/logout', (req, res) => {
  const sessionId = req.cookies.session;
  delete sessions[sessionId];
  res.clearCookie('session');
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
