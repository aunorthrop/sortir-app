const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const USERS_FILE = 'users.json';

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(session({
  secret: 'sortir_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  if (req.session.email) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    res.redirect('/login.html');
  }
});

app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(409).send('User already exists');

  users[email] = { password, files: [] };
  saveUsers(users);
  fs.mkdirSync(path.join(__dirname, 'uploads', email), { recursive: true });
  req.session.email = email;
  res.redirect('/');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].password !== password) {
    return res.status(401).send('Invalid credentials');
  }

  req.session.email = email;
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

app.post('/upload', (req, res) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    const fileName = JSON.parse(data).fileName;
    const email = req.session.email;
    const filePath = path.join(__dirname, 'uploads', email, fileName);
    fs.writeFileSync(filePath, 'Dummy content');
    const users = loadUsers();
    users[email].files.push(fileName);
    saveUsers(users);
    res.sendStatus(200);
  });
});

app.post('/delete', (req, res) => {
  const { fileName } = req.body;
  const email = req.session.email;
  const filePath = path.join(__dirname, 'uploads', email, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const users = loadUsers();
  users[email].files = users[email].files.filter(f => f !== fileName);
  saveUsers(users);
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
