const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const session = require('express-session');
const nodemailer = require('nodemailer');
const { Configuration, OpenAIApi } = require('openai');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const users = {}; // Temporary user store

// Setup session
app.use(session({
  secret: 'sortir-secret',
  resave: false,
  saveUninitialized: false,
}));

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// OpenAI setup
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, 'uploads', req.session.user || 'guest');
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (users[email]) {
    return res.status(400).json({ message: 'Email already in use' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users[email] = { password: hashedPassword };

  req.session.user = email;

  // Send confirmation email
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SORTIR_EMAIL,
        pass: process.env.SORTIR_PASS
      }
    });

    await transporter.sendMail({
      from: `"Sortir Vault" <${process.env.SORTIR_EMAIL}>`,
      to: email,
      subject: "Welcome to Sortir Vault",
      text: `Hi there! You've successfully created an account with Sortir Vault.`,
    });

    res.json({ message: 'Signup successful and email sent' });
  } catch (err) {
    console.error('Email error:', err);
    res.json({ message: 'Signup successful but email failed to send' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) return res.status(400).json({ message: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  req.session.user = email;
  res.json({ message: 'Login successful' });
});

// Upload
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ message: 'File uploaded successfully' });
});

// List files
app.get('/list-files', (req, res) => {
  const user = req.session.user || 'guest';
  const userDir = path.join(__dirname, 'uploads', user);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    res.json(files);
  });
});

// Delete file
app.post('/delete-file', (req, res) => {
  const { filename } = req.body;
  const user = req.session.user || 'guest';
  const userDir = path.join(__dirname, 'uploads', user);
  const filePath = path.join(userDir, filename);
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ message: 'Error deleting file' });
    res.json({ message: 'File deleted' });
  });
});

// Ask question
app.post('/ask', async (req, res) => {
  const user = req.session.user || 'guest';
  const userDir = path.join(__dirname, 'uploads', user);
  const { question } = req.body;

  fs.readdir(userDir, async (err, files) => {
    if (err || files.length === 0) {
      return res.status(400).json({ answer: 'No documents found.' });
    }

    let fullText = '';
    for (const file of files) {
      const filePath = path.join(userDir, file);
      try {
        const data = fs.readFileSync(filePath);
        const pdfText = await pdfParse(data);
        fullText += pdfText.text + '\n\n';
      } catch (e) {
        console.error(`Error parsing ${file}:`, e);
      }
    }

    try {
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant trained to answer questions based on uploaded business documents.' },
          { role: 'user', content: `${question}\n\nContext:\n${fullText}` }
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const answer = completion.data.choices[0].message.content.trim();
      res.json({ answer });
    } catch (error) {
      console.error('OpenAI error:', error);
      res.status(500).json({ answer: 'Error generating answer.' });
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Sortir Vault live on port ${port}`);
});
