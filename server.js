const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const session = require('express-session');
const { Configuration, OpenAIApi } = require('openai');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);

db.defaults({ users: [], sessions: {}, uploads: {} }).write();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: true
}));

const upload = multer({ dest: 'uploads/' });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Utility to get current user's uploads
function getUserUploads(userId) {
  return db.get('uploads').get(userId).value() || [];
}

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const userExists = db.get('users').find({ username }).value();
  if (userExists) return res.status(400).send('User already exists');
  db.get('users').push({ username, password }).write();
  req.session.user = username;
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username, password }).value();
  if (!user) return res.status(401).send('Invalid credentials');
  req.session.user = username;
  res.sendStatus(200);
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(200));
});

app.get('/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const file = req.file;
  const userId = req.session.user;

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const parsed = await pdfParse(dataBuffer);
    const content = parsed.text;

    const existing = getUserUploads(userId);
    db.get('uploads').set(userId, [...existing, {
      filename: file.originalname,
      path: file.path,
      content
    }]).write();

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to process file');
  }
});

app.get('/files', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  res.json(getUserUploads(req.session.user));
});

app.post('/delete', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const { filename } = req.body;
  const userId = req.session.user;

  const filtered = getUserUploads(userId).filter(f => f.filename !== filename);
  db.get('uploads').set(userId, filtered).write();
  res.sendStatus(200);
});

app.post('/ask', async (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  const { question } = req.body;
  const files = getUserUploads(req.session.user);
  const combinedText = files.map(f => f.content).join('\n').slice(-15000);

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering questions about internal business documents.' },
        { role: 'user', content: `Question: ${question}\n\nDocuments:\n${combinedText}` }
      ]
    });

    const answer = completion.data.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('OpenAI error');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
