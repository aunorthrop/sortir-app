const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = './users.json';
const RESET_TOKENS_FILE = './resetTokens.json';

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'sortir-secret',
    resave: false,
    saveUninitialized: true,
  })
);

// Helper: read/write JSON
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: 'Email already in use.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  users.push({ email, password: hashed });
  writeJSON(USERS_FILE, users);

  // Confirmation email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Sortir!',
    text: 'Your Sortir account was successfully created.',
  });

  req.session.user = email;
  res.status(200).json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = email;
  res.status(200).json({ success: true });
});

// Forgot Password
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const token = Math.random().toString(36).substring(2, 15);
  const tokens = readJSON(RESET_TOKENS_FILE);
  tokens[token] = email;
  writeJSON(RESET_TOKENS_FILE, tokens);

  const link = `https://${req.headers.host}/reset-password.html?token=${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset Your Sortir Password',
    text: `Click to reset: ${link}`,
  });

  res.status(200).json({ success: true });
});

// Reset Password
app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const tokens = readJSON(RESET_TOKENS_FILE);
  const email = tokens[token];
  if (!email) return res.status(400).json({ error: 'Invalid or expired token' });

  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ error: 'User not found' });

  user.password = await bcrypt.hash(password, 10);
  writeJSON(USERS_FILE, users);

  delete tokens[token];
  writeJSON(RESET_TOKENS_FILE, tokens);

  res.status(200).json({ success: true });
});

// Ask Sortir
app.post('/ask', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const { prompt, files } = req.body;

  const combinedText = files.map(f => f.text).join('\n\n');

  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: `Files:\n${combinedText}\n\nQuestion:\n${prompt}` }],
  });

  res.json({ answer: response.data.choices[0].message.content.trim() });
});

// Start
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
