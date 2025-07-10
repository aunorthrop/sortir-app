const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Configuration, OpenAIApi } = require('openai');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Store uploaded files' text in memory
let storedFiles = {};

app.post('/upload', upload.single('pdf'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const data = await pdfParse(dataBuffer);

    storedFiles[file.originalname] = data.text;
    fs.unlinkSync(file.path); // Delete the temp file
    res.status(200).json({ name: file.originalname });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

app.get('/files', (req, res) => {
  res.json(Object.keys(storedFiles));
});

app.post('/delete', (req, res) => {
  const { filename } = req.body;

  if (storedFiles[filename]) {
    delete storedFiles[filename];
    res.status(200).json({ message: 'Deleted successfully' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  const allContent = Object.entries(storedFiles)
    .map(([name, text]) => `Document: ${name}\n${text}`)
    .join('\n\n');

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that reads uploaded business documents and answers questions based on their content. Answer clearly and accurately, referring to the relevant document(s) when possible.',
        },
        {
          role: 'user',
          content: `Here are the uploaded documents:\n\n${allContent}\n\nUser question: ${question}`,
        },
      ],
    });

    const answer = response.data.choices[0].message.content.trim();
    res.json({ answer });
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate answer' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
