const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'data/users.json');
const UPLOADS_DIR = path.join(__dirname, 'data/uploads');

// Ensure required folders exist
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'SortirSecret123',
  resave: false,
  saveUninitialized: false,
}));

// Load users
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// Save users helper
const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Routes
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (users[email]) return res.status(409).send('Email already registered.');

  const passwordHash = await bcrypt.hash(password, 10);
  users[email] = { passwordHash };
  saveUsers();

  fs.mkdirSync(path.join(UPLOADS_DIR, email), { recursive: true });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Sortir!',
    text: 'Thanks for signing up. Your account is ready.'
  };

  transporter.sendMail(mailOptions);
  res.redirect('/login.html');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) return res.status(401).send('Invalid email or password.');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).send('Invalid email or password.');

  req.session.user = email;
  res.redirect('/dashboard.html');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = users[email];
  if (!user) return res.status(404).send('Email not found.');

  const token = crypto.randomBytes(20).toString('hex');
  users[email].resetToken = token;
  users[email].resetTokenExpiry = Date.now() + 3600000; // 1 hr
  saveUsers();

  const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}&email=${email}`;
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset your password',
    text: `Click to reset: ${resetLink}`
  });

  res.send('Password reset link sent.');
});

app.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  const user = users[email];
  if (!user || user.resetToken !== token || Date.now() > user.resetTokenExpiry) {
    return res.status(400).send('Invalid or expired token.');
  }

  const hash = await bcrypt.hash(password, 10);
  users[email].passwordHash = hash;
  delete users[email].resetToken;
  delete users[email].resetTokenExpiry;
  saveUsers();

  res.send('Password has been reset.');
});

app.post('/upload', (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required.');
  if (!req.files || !req.files.file) return res.status(400).send('No file uploaded.');

  const userDir = path.join(UPLOADS_DIR, req.session.user);
  fs.mkdirSync(userDir, { recursive: true });

  const filePath = path.join(userDir, req.files.file.name);
  req.files.file.mv(filePath, err => {
    if (err) return res.status(500).send('Upload failed.');
    res.send('File uploaded successfully.');
  });
});

app.get('/list-files', (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required.');

  const userDir = path.join(UPLOADS_DIR, req.session.user);
  if (!fs.existsSync(userDir)) return res.json([]);

  const files = fs.readdirSync(userDir);
  res.json(files);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
