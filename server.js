const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const { Configuration, OpenAIApi } = require("openai");
const path = require("path");

require("dotenv").config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.use(express.static("public"));
app.use(express.json());

let extractedText = "";
let uploadedFileName = "";

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const dataBuffer = req.file.buffer;
    const data = await pdf(dataBuffer);
    extractedText = data.text;
    uploadedFileName = req.file.originalname;

    res.json({ message: "File uploaded successfully", fileName: uploadedFileName });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!extractedText) {
      return res.json({ answer: "Please upload a PDF first." });
    }

    if (!question || question.trim() === "") {
      return res.json({ answer: "Please provide a question." });
    }

    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide concise and relevant answers based solely on the provided document content. If the answer is not in the document, state that you cannot find the information.",
        },
        {
          role: "user",
          content: `Document content:\n${extractedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion.data.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (error) {
    console.error("Error getting answer from OpenAI:", error);
    res.status(500).json({ error: "Failed to get answer from AI" });
  }
});

app.post("/delete", (req, res) => {
  try {
    extractedText = "";
    uploadedFileName = "";
    res.json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
