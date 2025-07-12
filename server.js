const express = require('express');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'data/users.json');

// ✅ Ensure upload folder exists
const uploadDir = path.join(__dirname, 'data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'SortTierSession123',
    resave: false,
    saveUninitialized: false,
  })
);

// ✅ Helper: Load users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// ✅ Helper: Save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ✅ Route: Serve login/signup page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// ✅ Route: Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users[email]) {
    return res.status(400).send('User already exists. Try logging in or reset password.');
  }

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed, files: [] };
  saveUsers(users);
  req.session.user = email;
  res.redirect('/dashboard.html');
});

// ✅ Route: Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (!users[email]) return res.status(400).send('Invalid email or password.');
  const valid = await bcrypt.compare(password, users[email].password);
  if (!valid) return res.status(401).send('Invalid email or password.');

  req.session.user = email;
  res.redirect('/dashboard.html');
});

// ✅ Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ✅ Route: Upload
app.post('/upload', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  if (!req.files || !req.files.file) return res.status(400).send('No file uploaded.');

  const user = req.session.user;
  const users = loadUsers();
  const file = req.files.file;
  const userDir = path.join(uploadDir, user);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  const filePath = path.join(userDir, file.name);
  await file.mv(filePath);

  users[user].files.push({ name: file.name, path: filePath });
  saveUsers(users);

  res.redirect('/dashboard.html');
});

// ✅ Route: Ask
app.post('/ask', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const { question } = req.body;
  const user = req.session.user;
  const users = loadUsers();
  const files = users[user].files;

  let fullText = '';
  for (const f of files) {
    const data = fs.readFileSync(f.path);
    const parsed = await pdfParse(data);
    fullText += parsed.text + '\n';
  }

  const prompt = `Answer the question using the following documents:\n\n${fullText}\n\nQuestion: ${question}`;

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await completion.json();
  const answer = data.choices?.[0]?.message?.content || 'No response';

  res.send(answer);
});

// ✅ Route: Forgot password
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.status(400).send('No account with that email.');

  const token = uuidv4();
  users[email].resetToken = token;
  users[email].resetExpires = Date.now() + 3600000; // 1 hour
  saveUsers(users);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const resetLink = `https://${req.headers.host}/reset-password.html?token=${token}&email=${email}`;

  await transporter.sendMail({
    to: email,
    subject: 'Password Reset for Sortir',
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link is valid for 1 hour.</p>`,
  });

  res.send('Check your email for a reset link.');
});

// ✅ Route: Reset password
app.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();

  if (
    !users[email] ||
    users[email].resetToken !== token ||
    Date.now() > users[email].resetExpires
  ) {
    return res.status(400).send('Invalid or expired token.');
  }

  users[email].password = await bcrypt.hash(newPassword, 10);
  delete users[email].resetToken;
  delete users[email].resetExpires;
  saveUsers(users);

  res.send('Password reset successful. You can now log in.');
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Sortir app running on http://localhost:${PORT}`);
});
