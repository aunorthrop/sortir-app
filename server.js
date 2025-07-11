const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = './users.json';
const RESET_TOKENS_FILE = './resetTokens.json';
const FILES_DIR = './uploads';

if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Load or create storage files
const loadJSON = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = loadJSON(USERS_FILE);
  if (users[email]) return res.status(400).send('Email already registered.');

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  saveJSON(USERS_FILE, users);

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Sortir',
    text: 'Thanks for signing up for Sortir!'
  });

  res.status(200).send('Signup successful');
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadJSON(USERS_FILE);
  const user = users[email];
  if (!user) return res.status(401).send('Incorrect credentials.');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).send('Incorrect credentials.');

  req.session.user = email;
  res.status(200).send('Login successful');
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(200));
});

// Forgot password
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadJSON(USERS_FILE);
  if (!users[email]) return res.status(404).send('Email not found.');

  const token = crypto.randomBytes(20).toString('hex');
  const tokens = loadJSON(RESET_TOKENS_FILE);
  tokens[token] = { email, expires: Date.now() + 3600000 };
  saveJSON(RESET_TOKENS_FILE, tokens);

  const resetLink = `${process.env.BASE_URL}/reset-password.html?token=${token}`;
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset',
    text: `Reset your password: ${resetLink}`
  });

  res.status(200).send('Reset link sent.');
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const tokens = loadJSON(RESET_TOKENS_FILE);
  const data = tokens[token];
  if (!data || data.expires < Date.now()) return res.status(400).send('Invalid or expired token.');

  const users = loadJSON(USERS_FILE);
  const hashed = await bcrypt.hash(password, 10);
  users[data.email].password = hashed;
  saveJSON(USERS_FILE, users);
  delete tokens[token];
  saveJSON(RESET_TOKENS_FILE, tokens);

  res.status(200).send('Password reset successful.');
});

// File upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FILES_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const filePath = path.join(FILES_DIR, req.file.filename);

  const files = loadJSON('./fileIndex.json');
  if (!files[req.session.user]) files[req.session.user] = [];
  files[req.session.user].push(filePath);
  saveJSON('./fileIndex.json', files);

  res.sendStatus(200);
});

// List files
app.get('/files', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const files = loadJSON('./fileIndex.json');
  res.json(files[req.session.user] || []);
});

// Delete file
app.post('/delete/:filename', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const files = loadJSON('./fileIndex.json');
  const userFiles = files[req.session.user] || [];

  const filePath = path.join(FILES_DIR, req.params.filename);
  const index = userFiles.indexOf(filePath);
  if (index !== -1) {
    userFiles.splice(index, 1);
    fs.unlinkSync(filePath);
    saveJSON('./fileIndex.json', files);
  }

  res.sendStatus(200);
});

// Ask Sortir
app.post('/ask', async (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const files = loadJSON('./fileIndex.json')[req.session.user] || [];
  let combinedText = '';

  for (const file of files) {
    try {
      const data = fs.readFileSync(file);
      const parsed = await pdfParse(data);
      combinedText += parsed.text + '\n';
    } catch {}
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant for retrieving business SOPs.' },
      { role: 'user', content: `${req.body.prompt}\n\nContext:\n${combinedText}` }
    ]
  });

  res.json({ answer: response.choices[0].message.content });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
