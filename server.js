const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

let storedTexts = [];

app.post('/upload', upload.single('pdf'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded.');

  const dataBuffer = fs.readFileSync(file.path);
  const parsedData = await pdfParse(dataBuffer);

  const newText = {
    name: file.originalname,
    content: parsedData.text,
    success: true,
  };

  storedTexts.push(newText);
  fs.unlinkSync(file.path); // Clean up

  res.json({ success: true, fileName: file.originalname });
});

app.post('/ask', async (req, res) => {
  const question = req.body.question;
  if (!question) return res.status(400).send('No question provided.');

  const combinedText = storedTexts.map(d => d.content).join('\n\n');

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for reading internal business documents.' },
        { role: 'user', content: `Here are the documents:\n${combinedText}\n\nUser question: ${question}` }
      ],
    });

    res.json({ answer: completion.data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating response.');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
