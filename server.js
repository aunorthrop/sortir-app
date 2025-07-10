const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const cors = require("cors");
require("dotenv").config();

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let storedTexts = [];

app.post("/upload", upload.single("pdf"), async (req, res) => {
  const dataBuffer = fs.readFileSync(req.file.path);
  const parsed = await pdfParse(dataBuffer);
  storedTexts.push({ name: req.file.originalname, text: parsed.text });
  fs.unlinkSync(req.file.path);
  res.json({ success: true });
});

app.post("/delete", (req, res) => {
  const { fileName } = req.body;
  storedTexts = storedTexts.filter(doc => doc.name !== fileName);
  res.json({ success: true });
});

app.post("/ask", async (req, res) => {
  const prompt = req.body.prompt;
  const fullText = storedTexts.map(doc => doc.text).join("\n\n");

  if (!fullText.trim()) {
    return res.json({ answer: "No documents uploaded." });
  }

  const fullPrompt = `Based on the following documents, answer this question:\n\n${fullText}\n\nQuestion: ${prompt}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: fullPrompt }],
    });
    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "An error occurred while processing your request." });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
