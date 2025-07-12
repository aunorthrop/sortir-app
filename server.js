const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup paths for persistent disk
const PERSIST_DIR = '/data';
const USERS_FILE = path.join(PERSIST_DIR, 'users.json');
const UPLOAD_DIR = path.join(PERSIST_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  store: new FileStore({ path: path.join(PERSIST_DIR, 'sessions') }),
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helpers
const loadUsers = () => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Routes

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/forgot-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users[email]) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { password: hashedPassword, resetToken: null, files: [] };
    saveUsers(users);
    req.session.userId = email;
    res.status(201).json({ success: true, message: 'Account created.', redirect: '/dashboard.html' });
  } catch {
    res.status(500).json({ success: false, message: 'Signup error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (!users[email]) {
    return res.status(400).json({ success: false, message: 'Invalid credentials.' });
  }

  try {
    const isMatch = await bcrypt.compare(password, users[email].password);
    if (isMatch) {
      req.session.userId = email;
      res.status(200).json({ success: true, message: 'Logged in.', redirect: '/dashboard.html' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }
  } catch {
    res.status(500).json({ success: false, message: 'Login error.' });
  }
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) {
    return res.status(200).json({ success: true, message: 'If email exists, reset link sent.' });
  }

  const token = uuidv4();
  users[email].resetToken = {
    value: token,
    expires: Date.now() + 3600000
  };
  saveUsers(users);

  const resetLink = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;
  const mailOptions = {
    from: `"Sortir" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your password',
    html: `<p>Click below to reset:</p><a href="${resetLink}">Reset Password</a>`
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to send email.' });
    }
    res.status(200).json({ success: true, message: 'Reset link sent.' });
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();

  const user = users[email];
  if (!user || !user.resetToken) {
    return res.status(400).json({ success: false, message: 'Invalid reset.' });
  }

  const valid = user.resetToken.value === token && Date.now() < user.resetToken.expires;
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Expired or invalid token.' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    users[email].password = hashed;
    users[email].resetToken = null;
    saveUsers(users);
    res.status(200).json({ success: true, message: 'Password reset.' });
  } catch {
    res.status(500).json({ success: false, message: 'Reset error.' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const users = loadUsers();
  const userId = req.session.userId;

  if (!req.file || !userId || !users[userId]) {
    return res.status(401).json({ success: false, message: 'Unauthorized or no file.' });
  }

  if (!users[userId].files.includes(req.file.filename)) {
    users[userId].files.push(req.file.filename);
    saveUsers(users);
  }

  res.status(200).json({ success: true, filename: req.file.filename });
});

app.get('/api/files', (req, res) => {
  const users = loadUsers();
  const userId = req.session.userId;

  if (!userId || !users[userId]) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const files = users[userId].files.filter(f =>
    fs.existsSync(path.join(UPLOAD_DIR, f))
  );

  res.status(200).json({ success: true, files });
});

app.post('/api/delete-file', (req, res) => {
  const { filename } = req.body;
  const users = loadUsers();
  const userId = req.session.userId;

  if (!userId || !users[userId]) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    users[userId].files = users[userId].files.filter(f => f !== filename);
    saveUsers(users);
    res.status(200).json({ success: true, message: `${filename} deleted.` });
  } else {
    res.status(404).json({ success: false, message: 'File not found.' });
  }
});

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ success: false, message: 'Question is required.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: question }]
    });

    const answer = completion.choices[0].message.content;
    res.status(200).json({ success: true, answer });
  } catch {
    res.status(500).json({ success: false, message: 'OpenAI error.' });
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, message: 'Logout failed.' });
    res.clearCookie('connect.sid');
    res.status(200).json({ success: true, message: 'Logged out.' });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
