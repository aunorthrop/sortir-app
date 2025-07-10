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

let documents = []; // Store array of { name, text }

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const data = await pdf(req.file.buffer);
    const extractedText = data.text.trim();

    if (!extractedText) {
      return res.status(500).json({ error: "Failed to extract text from PDF." });
    }

    documents.push({
      name: req.file.originalname,
      text: extractedText,
    });

    res.json({ message: "File uploaded successfully", fileName: req.file.originalname });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF." });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.json({ answer: "Please provide a question." });
    }

    if (documents.length === 0) {
      return res.json({ answer: "Please upload at least one PDF before asking." });
    }

    const combinedText = documents.map(doc => `From ${doc.name}:\n${doc.text}`).join("\n\n");

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide concise and relevant answers based solely on the provided document content. If the answer is not in the document, say you cannot find the information.",
        },
        {
          role: "user",
          content: `Document content:\n${combinedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (error) {
    console.error("Error from OpenAI:", error);
    res.status(500).json({ error: "Failed to get answer from AI." });
  }
});

app.post("/delete", (req, res) => {
  try {
    documents = []; // Clear all stored documents
    res.json({ message: "All uploaded files deleted successfully." });
  } catch (error) {
    console.error("Error clearing documents:", error);
    res.status(500).json({ error: "Failed to delete files." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
