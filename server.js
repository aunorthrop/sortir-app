const express = require('express');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require('openai');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static('public'));

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

app.post('/upload', async (req, res) => {
  const { name, content } = req.body;
  const buffer = Buffer.from(content, 'base64');
  fs.writeFileSync(path.join(uploadsDir, name), buffer);
  res.send({ success: true });
});

app.post('/delete', (req, res) => {
  const filePath = path.join(uploadsDir, req.body.name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.send({ success: true });
});

app.post('/ask', async (req, res) => {
  const prompt = req.body.prompt;
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));

  let combinedText = '';
  for (const file of files) {
    const data = fs.readFileSync(path.join(uploadsDir, file));
    const pdf = await pdfParse(data);
    combinedText += pdf.text + '\n';
  }

  const userInput = `User asked: "${prompt}"\n\nRelevant info:\n${combinedText}`;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a business assistant. Use the uploaded document content to answer questions helpfully and directly." },
        { role: "user", content: userInput }
      ],
      temperature: 0.3
    });

    const answer = completion.data.choices[0].message.content;
    res.send({ response: answer });
  } catch (error) {
    console.error(error);
    res.status(500).send({ response: 'Error processing your request.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
