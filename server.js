const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'sortir-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Persistent path
const UPLOADS_ROOT = path.join('/data', 'uploads');
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

// Multer storage by user
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userEmail = req.session.email;
    if (!userEmail) return cb(new Error('No user session'));

    const userDir = path.join(UPLOADS_ROOT, userEmail);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// === Routes ===

// File upload
app.post('/upload', upload.single('pdf'), (req, res) => {
  res.status(200).send('Upload successful');
});

// File list
app.get('/files', (req, res) => {
  const email = req.session.email;
  if (!email) return res.json([]);

  const userDir = path.join(UPLOADS_ROOT, email);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    res.json(files);
  });
});

// Delete file
app.post('/delete', (req, res) => {
  const { filename } = req.body;
  const email = req.session.email;
  if (!email || !filename) return res.status(400).send('Invalid');

  const userDir = path.join(UPLOADS_ROOT, email);
  const filePath = path.join(userDir, filename);

  fs.unlink(filePath, err => {
    if (err) return res.status(500).send('Delete failed');
    res.sendStatus(200);
  });
});

// Session login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));

  if (users[email] && users[email].password === password) {
    req.session.email = email;
    res.redirect('/dashboard.html');
  } else {
    res.status(401).send('Incorrect login');
  }
});

// Signup
app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  const usersPath = './data/users.json';

  let users = {};
  if (fs.existsSync(usersPath)) {
    users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  }

  if (users[email]) {
    return res.status(409).send('User exists');
  }

  users[email] = { password };
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  req.session.email = email;
  res.redirect('/dashboard.html');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
