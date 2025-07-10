const express = require("express");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));

app.post("/ask", async (req, res) => {
  try {
    const { question, base64pdf } = req.body;
    if (!base64pdf || !question) {
      return res.status(400).json({ error: "Missing file or question." });
    }

    const base64Data = base64pdf.split(";base64,").pop();
    const buffer = Buffer.from(base64Data, "base64");
    const data = await pdf(buffer);
    const extractedText = data.text;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide concise and relevant answers based solely on the provided document content. If the answer is not in the document, say so clearly.",
        },
        {
          role: "user",
          content: `Document content:\n${extractedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion?.choices?.[0]?.message?.content;
    if (!answer) {
      console.error("No response from OpenAI:", chatCompletion);
      return res.status(500).json({ error: "No answer returned from OpenAI." });
    }

    res.json({ answer });
  } catch (error) {
    console.error("Error in /ask route:", error);
    res.status(500).json({ error: "Failed to get answer from OpenAI." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
