const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true,
}));

const USERS_FILE = './users.json';
const RESET_TOKENS_FILE = './resetTokens.json';

function readJSON(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// OpenAI setup
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');

  const filePath = req.file.path;
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  req.session.files = req.session.files || [];
  req.session.files.push({ name: req.file.originalname, text: data.text });
  fs.unlinkSync(filePath);

  res.json({ success: true });
});

// Ask endpoint
app.post('/ask', async (req, res) => {
  if (!req.session.user || !req.session.files) return res.status(401).send('Unauthorized');

  const question = req.body.question;
  const combinedText = req.session.files.map(f => f.text).join('\n\n');

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: "system", content: "You are Sortir, a helpful assistant." },
        { role: "user", content: `Answer the following question using this data:\n${combinedText}\n\nQuestion: ${question}` }
      ],
    });

    res.json({ answer: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get answer from AI.' });
  }
});

// Delete file endpoint
app.post('/delete', (req, res) => {
  const index = req.body.index;
  if (req.session.files && req.session.files[index]) {
    req.session.files.splice(index, 1);
  }
  res.json({ success: true });
});

// Get files
app.get('/files', (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  res.json(req.session.files || []);
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  if (users[email]) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  writeJSON(USERS_FILE, users);

  sendEmail(email, 'Sortir: Account Created', 'You successfully registered at Sortir.');

  req.session.user = email;
  res.json({ success: true });
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);

  if (!users[email]) return res.status(400).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, users[email].password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.user = email;
  res.json({ success: true });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Forgot password - generate token
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = readJSON(USERS_FILE);
  if (!users[email]) return res.status(400).json({ error: 'Email not registered' });

  const token = crypto.randomBytes(32).toString('hex');
  const resetTokens = readJSON(RESET_TOKENS_FILE);
  resetTokens[token] = { email, expires: Date.now() + 3600000 };
  writeJSON(RESET_TOKENS_FILE, resetTokens);

  const resetLink = `https://${req.headers.host}/reset-password.html?token=${token}`;
  sendEmail(email, 'Sortir Password Reset', `Reset your password using this link:\n${resetLink}`);

  res.json({ success: true });
});

// Reset password - update with new one
app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const resetTokens = readJSON(RESET_TOKENS_FILE);
  const users = readJSON(USERS_FILE);

  const entry = resetTokens[token];
  if (!entry || Date.now() > entry.expires) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const hashed = await bcrypt.hash(password, 10);
  users[entry.email].password = hashed;
  delete resetTokens[token];

  writeJSON(USERS_FILE, users);
  writeJSON(RESET_TOKENS_FILE, resetTokens);

  res.json({ success: true });
});

// Email sending function using Gmail
function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,      // your Gmail address
      pass: process.env.EMAIL_PASS       // your Gmail app password
    }
  });

  transporter.sendMail({
    from: `"Sortir" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
