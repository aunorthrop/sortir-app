const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let storedTexts = [];

app.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = path.join(__dirname, req.file.path);

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    storedTexts.push({ name: req.file.originalname, content: data.text });

    fs.unlinkSync(filePath); // delete temp file
    res.status(200).json({ message: 'PDF uploaded and parsed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF.' });
  }
});

app.post('/ask', async (req, res) => {
  const { prompt } = req.body;
  const combinedText = storedTexts.map(doc => doc.content).join('\n\n');

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that answers questions based on the following business documents.' },
        { role: 'user', content: `Documents:\n${combinedText}\n\nQuestion:\n${prompt}` },
      ],
    });

    const answer = response.data.choices[0].message.content;
    res.send(answer);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Failed to get a response from the AI.');
  }
});

app.get('/files', (req, res) => {
  const fileNames = storedTexts.map(doc => doc.name);
  res.json(fileNames);
});

app.post('/delete', (req, res) => {
  const fileName = req.body.name;
  storedTexts = storedTexts.filter(doc => doc.name !== fileName);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
