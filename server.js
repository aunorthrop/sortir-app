const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();
// Configure multer to store files in memory temporarily
// This might help with very subtle file access timing issues,
// but the 'dest' property should also work fine.
// Using memory storage means no temporary file cleanup needed explicitly.
const upload = multer({ storage: multer.memoryStorage() });


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json());

let extractedText = "";
let uploadedFileName = "";

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // If using memory storage, req.file.buffer contains the file data
    const dataBuffer = req.file.buffer; 
    const data = await pdf(dataBuffer);
    extractedText = data.text;
    uploadedFileName = req.file.originalname; 

    // If using 'dest' property for multer (e.g., multer({ dest: "uploads/" })), 
    // you would need to read the file from disk and then unlink it:
    // const dataBuffer = fs.readFileSync(req.file.path);
    // const data = await pdf(dataBuffer);
    // extractedText = data.text;
    // uploadedFileName = req.file.originalname;
    // fs.unlinkSync(req.file.path); // delete file after reading

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

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
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

    const answer = chatCompletion.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (error) {
    console.error("Error getting answer from OpenAI:", error);
    res.status(500).json({ error: "Failed to get answer from AI" });
  }
});

app.post("/delete", (req, res) => {
    console.log("DELETE request received at /delete endpoint."); 
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
