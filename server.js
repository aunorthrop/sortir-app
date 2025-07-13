if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const SQLiteStore = require('connect-sqlite3')(session);
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const DB_FILE_PATH = './data/database.db';
const SESSION_DB_PATH = './data/sessions.db';

const dataDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
  if (err) console.error('Error opening DB:', err);
  else {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      resetPasswordToken TEXT,
      resetPasswordExpires INTEGER
    )`);
  }
});

const initializePassport = require('./passport-config');
initializePassport(
  passport,
  email => new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  }),
  id => new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  })
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.db', dir: path.dirname(SESSION_DB_PATH), table: 'sessions' })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.static('public'));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userDir = `./uploads/${req.user.email}`;
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  })
});

app.get('/', checkAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const id = Date.now().toString();
    db.run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, req.body.name, req.body.email, hashedPassword],
      (err) => {
        if (err) {
          req.flash('error', 'Email already registered.');
          return res.redirect('/register');
        }
        res.redirect('/login');
      });
  } catch (e) {
    console.error('Register error:', e);
    res.redirect('/register');
  }
});

app.post('/upload', checkAuthenticated, upload.single('file'), (req, res) => {
  res.json({ success: true });
});

app.get('/files', checkAuthenticated, (req, res) => {
  const userDir = `./uploads/${req.user.email}`;
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    res.json(files);
  });
});

app.delete('/delete/:filename', checkAuthenticated, (req, res) => {
  const filePath = `./uploads/${req.user.email}/${req.params.filename}`;
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ success: true });
  });
});

app.delete('/logout', (req, res) => {
  req.logOut(err => {
    if (err) return res.redirect('/');
    res.redirect('/login');
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return res.redirect('/');
  next();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
