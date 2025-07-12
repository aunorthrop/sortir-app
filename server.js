const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'sortir_secret_key',
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const loadUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE));
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users[email]) return res.status(400).send('Email already registered.');

  users[email] = { password, resetToken: null, files: [] };
  saveUsers(users);
  req.session.user = email;
  res.redirect('/dashboard.html');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (!users[email] || users[email].password !== password) {
    return res.status(401).send('Incorrect email or password.');
  }

  req.session.user = email;
  res.redirect('/dashboard.html');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, 'data', 'uploads', req.session.user);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const users = loadUsers();
  const email = req.session.user;

  if (!users[email]) return res.status(401).send('Not logged in.');

  users[email].files.push(req.file.filename);
  saveUsers(users);
  res.redirect('/dashboard.html');
});

app.get('/files', (req, res) => {
  const users = loadUsers();
  const email = req.session.user;
  if (!users[email]) return res.status(401).json([]);

  res.json(users[email].files || []);
});

app.post('/delete', (req, res) => {
  const { filename } = req.body;
  const email = req.session.user;
  const users = loadUsers();

  const userDir = path.join(__dirname, 'data', 'uploads', email);
  const filePath = path.join(userDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  users[email].files = users[email].files.filter(f => f !== filename);
  saveUsers(users);
  res.sendStatus(200);
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) return res.status(400).send('Email not registered.');

  const token = crypto.randomBytes(32).toString('hex');
  users[email].resetToken = token;
  saveUsers(users);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'appsortir@gmail.com',
      pass: process.env.GMAIL_PASSWORD
    }
  });

  const resetUrl = `https://${req.headers.host}/reset-password.html?token=${token}&email=${email}`;
  const mailOptions = {
    from: 'Sortir App <appsortir@gmail.com>',
    to: email,
    subject: 'Password Reset',
    html: `<p>Click to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) return res.status(500).send('Error sending email.');
    res.send('Password reset email sent.');
  });
});

app.post('/reset-password', (req, res) => {
  const { email, token, password } = req.body;
  const users = loadUsers();

  if (!users[email] || users[email].resetToken !== token) {
    return res.status(400).send('Invalid token or email.');
  }

  users[email].password = password;
  users[email].resetToken = null;
  saveUsers(users);
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
