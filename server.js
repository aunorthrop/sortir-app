const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage for all PDF text
let storedDocs = [];

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const data = await pdfParse(req.file.buffer);
    const fileText = data.text;
    const fileName = req.file.originalname;

    storedDocs.push({ name: fileName, content: fileText });

    res.json({ message: "File uploaded successfully", fileName });
  } catch (error) {
    console.error("PDF parse error:", error);
    res.status(500).json({ error: "Failed to extract text from PDF." });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.json({ answer: "Please enter a question." });
    }

    if (storedDocs.length === 0) {
      return res.json({ answer: "No documents uploaded yet." });
    }

    const combinedText = storedDocs.map(doc => `From ${doc.name}:\n${doc.content}`).join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant answering questions based only on uploaded internal documents. Be concise and accurate. If info is missing, say so."
        },
        {
          role: "user",
          content: `Documents:\n${combinedText}\n\nQuestion: ${question}`
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    const answer = response.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "Failed to get answer from AI." });
  }
});

app.post("/delete", (req, res) => {
  storedDocs = [];
  res.json({ message: "All uploaded documents cleared." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
