const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf-parse');
const { Configuration, OpenAIApi } = require('openai');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [], resetTokens: [] }).write();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: false
}));

const userFilesDir = email => path.join(__dirname, 'uploads', encodeURIComponent(email));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

function ensureAuth(req, res, next) {
  if (req.session.email) return next();
  res.status(401).json({ message: 'Unauthorized' });
}

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (db.get('users').find({ email }).value()) {
    return res.status(400).json({ message: 'Email already in use' });
  }
  const hashed = await bcrypt.hash(password, 10);
  db.get('users').push({ email, password: hashed }).write();
  const userDir = userFilesDir(email);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);
  req.session.email = email;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Sortir',
    text: 'Your account has been successfully created.'
  });

  res.json({ message: 'Signed up' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.get('users').find({ email }).value();
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: 'Invalid credentials' });
  req.session.email = email;
  res.json({ message: 'Logged in' });
});

app.get('/check-session', (req, res) => {
  res.json({ loggedIn: !!req.session.email });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.post('/upload', ensureAuth, upload.single('file'), (req, res) => {
  const email = req.session.email;
  const userDir = userFilesDir(email);
  const filePath = path.join(userDir, req.file.originalname);
  fs.renameSync(req.file.path, filePath);
  res.sendStatus(200);
});

app.get('/files', ensureAuth, (req, res) => {
  const email = req.session.email;
  const userDir = userFilesDir(email);
  const files = fs.existsSync(userDir) ? fs.readdirSync(userDir) : [];
  res.json(files);
});

app.delete('/delete/:filename', ensureAuth, (req, res) => {
  const email = req.session.email;
  const userDir = userFilesDir(email);
  const filePath = path.join(userDir, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.sendStatus(200);
});

app.post('/ask', ensureAuth, async (req, res) => {
  const email = req.session.email;
  const userDir = userFilesDir(email);
  const question = req.body.question;

  let combinedText = '';
  const files = fs.readdirSync(userDir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(userDir, file));
    const parsed = await PDFParser(content).catch(() => ({ text: '' }));
    combinedText += parsed.text + '\n';
  }

  const prompt = `Answer this based on the content below:\n\n${combinedText}\n\nQuestion: ${question}`;
  const response = await openai.createCompletion({
    model: 'gpt-3.5-turbo-instruct',
    prompt,
    max_tokens: 500
  });

  res.json({ answer: response.data.choices[0].text.trim() });
});

app.post('/reset-request', (req, res) => {
  const { email } = req.body;
  const user = db.get('users').find({ email }).value();
  if (!user) return res.status(400).json({ message: 'Email not found' });

  const token = crypto.randomBytes(32).toString('hex');
  db.get('resetTokens').remove({ email }).write();
  db.get('resetTokens').push({ email, token }).write();

  const resetLink = `${process.env.RESET_URL}/reset-password?token=${token}`;

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset your Sortir password',
    text: `Click here to reset your password: ${resetLink}`
  });

  res.json({ message: 'Reset link sent' });
});

app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const record = db.get('resetTokens').find({ token }).value();
  if (!record) return res.status(400).json({ message: 'Invalid token' });

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.get('users').find({ email: record.email }).assign({ password: hashed }).write();
  db.get('resetTokens').remove({ token }).write();

  res.json({ message: 'Password updated' });
});

app.listen(port, () => console.log(`Sortir running on port ${port}`));
