const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(fileUpload());
app.use(express.static('public'));
app.use(express.json());

let allTextChunks = [];

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Handle PDF upload
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.pdfFile) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.pdfFile;
  const data = await pdfParse(file.data);

  allTextChunks.push(data.text);
  res.send({ message: 'PDF uploaded and processed.' });
});

// Handle question asking
app.post('/ask', async (req, res) => {
  const question = req.body.question;
  const combinedText = allTextChunks.join('\n\n');

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that answers questions based only on the uploaded business documents.' },
        { role: 'user', content: `Documents:\n${combinedText}\n\nQuestion: ${question}` }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const answer = completion.data.choices[0].message.content.trim();
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing question.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
