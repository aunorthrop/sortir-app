const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = './users.json';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '{}');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) {
    return res.json({ success: false, message: 'Email already registered' });
  }
  users[email] = { password, resetToken: null, files: [] };
  saveUsers(users);

  fs.mkdirSync(`./userfiles/${email}`, { recursive: true });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Sortir!',
    text: 'Your account was successfully created.'
  };
  transporter.sendMail(mailOptions);

  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].password !== password) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }
  req.session.user = email;
  res.json({ success: true });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.json({ success: false, message: 'Email not found' });

  const token = uuidv4();
  users[email].resetToken = token;
  saveUsers(users);

  const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}&email=${email}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset your Sortir password',
    text: `Click the following link to reset your password: ${resetLink}`
  };
  transporter.sendMail(mailOptions);

  res.json({ success: true });
});

app.post('/reset-password', (req, res) => {
  const { email, token, password } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].resetToken !== token) {
    return res.json({ success: false, message: 'Invalid token' });
  }
  users[email].password = password;
  users[email].resetToken = null;
  saveUsers(users);
  res.json({ success: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userDir = path.join(__dirname, 'userfiles', req.session.user);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const users = loadUsers();
  const email = req.session.user;
  if (!email || !users[email]) return res.status(401).send('Unauthorized');

  users[email].files.push(req.file.originalname);
  saveUsers(users);
  res.json({ success: true });
});

app.get('/files', (req, res) => {
  const users = loadUsers();
  const email = req.session.user;
  if (!email || !users[email]) return res.status(401).send('Unauthorized');

  res.json(users[email].files || []);
});

app.post('/delete', (req, res) => {
  const { filename } = req.body;
  const email = req.session.user;
  const users = loadUsers();

  const filepath = path.join(__dirname, 'userfiles', email, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    users[email].files = users[email].files.filter(f => f !== filename);
    saveUsers(users);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'File not found' });
  }
});

app.post('/ask', async (req, res) => {
  const email = req.session.user;
  const users = loadUsers();
  if (!email || !users[email]) return res.status(401).send('Unauthorized');

  const { question } = req.body;
  const userDir = path.join(__dirname, 'userfiles', email);
  const allText = [];

  for (const file of users[email].files) {
    const filePath = path.join(userDir, file);
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(dataBuffer);
    allText.push(parsed.text);
  }

  const prompt = `Here are the user's documents:\n\n${allText.join('\n\n')}\n\nAnswer this question: ${question}`;

  try {
    const response = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4'
    });
    const reply = response.choices[0].message.content;
    res.json({ answer: reply });
  } catch (err) {
    res.status(500).json({ error: 'OpenAI API error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Sortir is live on port ${PORT}`);
});
