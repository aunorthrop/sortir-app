const express = require("express");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json({ limit: "20mb" }));

app.post("/ask", async (req, res) => {
  try {
    const { question, pdfs } = req.body;

    if (!Array.isArray(pdfs) || pdfs.length === 0 || !question) {
      return res.status(400).json({ error: "Missing PDFs or question." });
    }

    let combinedText = "";

    for (const base64pdf of pdfs) {
      const base64Data = base64pdf.split(";base64,").pop();
      const buffer = Buffer.from(base64Data, "base64");
      const data = await pdf(buffer);
      combinedText += "\n\n" + data.text;
    }

    // Limit to ~12,000 tokens worth of characters
    const maxLength = 48000;
    if (combinedText.length > maxLength) {
      combinedText = combinedText.slice(0, maxLength);
    }

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide clear and relevant answers based only on the documents provided below. If you don’t find the answer, say so clearly.",
        },
        {
          role: "user",
          content: `Here are the combined documents:\n${combinedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("⚠️ No usable response from OpenAI. Full response:", JSON.stringify(chatCompletion, null, 2));
      return res.status(500).json({ error: "No answer returned from OpenAI." });
    }

    res.json({ answer });
  } catch (error) {
    console.error("❌ Error in /ask route:", error);
    res.status(500).json({ error: "Failed to get answer from OpenAI." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
