import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import pdfParse from 'pdf-parse';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let storedTexts = [];

app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).send('No file uploaded.');
  }

  const uploadedFile = req.files.pdf;

  try {
    const data = await pdfParse(uploadedFile.data);
    storedTexts.push({ name: uploadedFile.name, text: data.text });
    res.send({ success: true, name: uploadedFile.name });
  } catch (error) {
    res.status(500).send('Failed to parse PDF');
  }
});

app.post('/ask', async (req, res) => {
  const question = req.body.question;

  if (!question || storedTexts.length === 0) {
    return res.status(400).send({ answer: 'No question provided or no documents uploaded.' });
  }

  const combinedText = storedTexts.map(doc => `From ${doc.name}:\n${doc.text}`).join('\n\n');

  try {
    const chat = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant who answers questions based on the documents provided.' },
        { role: 'user', content: `Documents:\n${combinedText}\n\nQuestion: ${question}` }
      ],
      model: 'gpt-4'
    });

    const answer = chat.choices[0].message.content;
    res.send({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).send({ answer: 'Failed to fetch answer from OpenAI.' });
  }
});

app.post('/delete', (req, res) => {
  const fileName = req.body.name;
  storedTexts = storedTexts.filter(doc => doc.name !== fileName);
  res.send({ success: true });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
