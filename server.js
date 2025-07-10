const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("public"));
app.use(express.json());

let documents = []; // Store { fileName, text }

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const data = await pdf(req.file.buffer);
    documents.push({ fileName: req.file.originalname, text: data.text });

    res.json({ message: "File uploaded successfully", fileName: req.file.originalname });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

app.post("/ask", async (req, res) => {
  const { question } = req.body;

  if (!question || question.trim() === "")
    return res.json({ answer: "Please enter a question." });

  if (documents.length === 0)
    return res.json({ answer: "No documents uploaded yet." });

  try {
    const combinedText = documents.map(d => `From ${d.fileName}:\n${d.text}`).join("\n\n");

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Use the content provided and say if you can't find the info."
        },
        {
          role: "user",
          content: `Document content:\n${combinedText}\n\nQuestion: ${question}`
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    const answer = chatCompletion.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Failed to get answer from AI" });
  }
});

app.post("/delete", (req, res) => {
  try {
    documents = [];
    res.json({ message: "All files deleted." });
  } catch (error) {
    res.status(500).json({ error: "Delete failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
