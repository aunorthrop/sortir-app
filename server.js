require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const OpenAI = require('openai'); // Correct constructor for v3.2.1+

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

let documents = [];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Upload PDF
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    documents.push({ name: req.file.originalname, text: pdfData.text });
    res.status(200).json({ message: 'File uploaded and parsed successfully.' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to extract text from PDF.' });
  }
});

// List documents
app.get('/documents', (req, res) => {
  const names = documents.map((doc) => doc.name);
  res.status(200).json({ documents: names });
});

// Delete document
app.post('/delete', (req, res) => {
  const { name } = req.body;
  documents = documents.filter(doc => doc.name !== name);
  res.status(200).json({ message: 'Document deleted.' });
});

// Ask question
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (documents.length === 0) {
    return res.status(400).json({ message: 'No documents uploaded.' });
  }

  const combinedText = documents.map(doc => doc.text).join('\n\n');
  const prompt = `You are a helpful assistant. Use the following documents to answer the question:\n\n${combinedText}\n\nQuestion: ${question}\nAnswer:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ message: 'Failed to get a response from OpenAI.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
});
