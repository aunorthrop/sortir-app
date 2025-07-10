const express = require('express');
const session = require('express-session');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Low, JSONFile } = require('lowdb');
const path = require('path');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// === Storage Setup ===
const storage = multer.memoryStorage();
const upload = multer({ storage });

// === Session ===
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// === DB Setup ===
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

(async () => {
  await db.read();
  db.data ||= { users: [], uploads: {} };
  await db.write();
})();

// === Auth ===
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  await db.read();

  const userExists = db.data.users.find(user => user.email === email);
  if (userExists) return res.status(400).json({ error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  db.data.users.push({ email, password: hashed });
  await db.write();

  req.session.user = email;
  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();

  const user = db.data.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = email;
  res.json({ success: true });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

const getUserUploads = (email) => db.data.uploads[email] || [];

// === Upload ===
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');

  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded');

  try {
    const text = await pdfParse(file.buffer);
    await db.read();

    db.data.uploads[req.session.user] ||= [];
    db.data.uploads[req.session.user].push({ name: file.originalname, text: text.text });
    await db.write();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('PDF parse failed');
  }
});

// === Delete ===
app.post('/delete', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');

  const { filename } = req.body;
  await db.read();

  db.data.uploads[req.session.user] = getUserUploads(req.session.user)
    .filter(file => file.name !== filename);
  await db.write();

  res.json({ success: true });
});

// === Ask ===
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!req.session.user) return res.status(401).send('Unauthorized');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  await db.read();
  const uploads = getUserUploads(req.session.user);
  const combinedText = uploads.map(f => f.text).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering questions based on internal documents.' },
        { role: 'user', content: `Question: ${question}\n\nDocuments:\n${combinedText}` }
      ]
    });

    const answer = response.choices?.[0]?.message?.content || 'No response.';
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).send('OpenAI error');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
