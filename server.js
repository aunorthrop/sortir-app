const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
let storedTexts = [];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    const dataBuffer = fs.readFileSync(file.path);
    const data = await pdfParse(dataBuffer);
    storedTexts.push({ text: data.text, name: file.originalname });
    fs.unlinkSync(file.path); // delete uploaded file after parsing
    res.status(200).json({ message: 'File uploaded and parsed successfully.' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload and parse PDF.' });
  }
});

app.post('/ask', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided.' });
  }

  const combinedText = storedTexts.map(doc => doc.text).join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant answering questions based on uploaded business documents.' },
        { role: 'user', content: `Documents:\n${combinedText}\n\nQuestion:\n${prompt}` },
      ],
    });

    const answer = response.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ error: 'Failed to get a response from OpenAI.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
