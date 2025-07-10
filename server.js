require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const { OpenAI } = require('openai');

console.log("🟢 Server is starting...");

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let storedFiles = [];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const dataBuffer = await fs.promises.readFile(file.path);
    const parsedData = await pdfParse(dataBuffer);

    storedFiles.push({
      name: file.originalname,
      content: parsedData.text
    });

    fs.unlink(file.path, () => {});
    res.status(200).json({ message: 'File uploaded and parsed successfully.' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to extract text from PDF.' });
  }
});

app.post('/delete', (req, res) => {
  const { fileName } = req.body;
  storedFiles = storedFiles.filter(file => file.name !== fileName);
  res.status(200).json({ message: 'File deleted successfully.' });
});

app.post('/ask', async (req, res) => {
  try {
    const question = req.body.question;
    const fullContext = storedFiles.map(f => `${f.name}:\n${f.content}`).join('\n\n');

    const prompt = `You are Sortir, a helpful assistant for small business documents.\n\nContext:\n${fullContext}\n\nQuestion: ${question}\n\nAnswer:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ message: 'Failed to get a response from Sortir.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
});
