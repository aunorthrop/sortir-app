const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let uploadedDocuments = []; // { name, text }

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const dataBuffer = req.file.buffer;
    const data = await pdf(dataBuffer);

    if (!data.text || data.text.trim() === "") {
      return res.status(400).json({ error: "Failed to extract text from PDF." });
    }

    const fileData = {
      name: req.file.originalname,
      text: data.text
    };

    uploadedDocuments.push(fileData);
    res.json({ message: "File uploaded successfully", fileName: fileData.name });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!uploadedDocuments.length) {
      return res.json({ answer: "Please upload at least one PDF first." });
    }

    const combinedText = uploadedDocuments.map(doc => doc.text).join("\n---\n");

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide concise and relevant answers based solely on the provided document content. If the answer is not in the document, state that you cannot find the information.",
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
    console.error("Error asking Sortir:", error);
    res.status(500).json({ error: "Failed to get answer from AI" });
  }
});

app.post("/delete", (req, res) => {
  const { fileName } = req.body;

  try {
    uploadedDocuments = uploadedDocuments.filter(doc => doc.name !== fileName);
    res.json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
