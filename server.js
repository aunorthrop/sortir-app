const express = require("express");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json({ limit: '10mb' })); // Needed for base64 PDF data

app.post("/ask", async (req, res) => {
  try {
    const { question, base64pdf } = req.body;
    if (!base64pdf || !question) {
      return res.status(400).json({ error: "Missing file or question." });
    }

    // Decode base64 PDF
    const base64Data = base64pdf.split(";base64,").pop(); // remove data header
    const buffer = Buffer.from(base64Data, "base64");

    // Extract text from PDF
    const data = await pdf(buffer);
    const extractedText = data.text;

    // Query OpenAI
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
    console.error("Error in /ask:", error);
    res.status(500).json({ error: "Failed to get answer" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
