const express = require("express");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");

const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json({ limit: "20mb" }));

app.get("/", (req, res) => {
  res.send("✅ Sortir server is running.");
});

app.post("/ask", async (req, res) => {
  try {
    const { question, pdfs, filenames } = req.body;

    if (!Array.isArray(pdfs) || pdfs.length === 0 || !question) {
      console.error("❌ Invalid input: missing PDFs or question");
      return res.status(400).json({ error: "Missing PDFs or question." });
    }

    console.log(`📥 Received ${pdfs.length} PDFs and question: ${question}`);

    let combinedText = "";

    for (let i = 0; i < pdfs.length; i++) {
      const base64pdf = pdfs[i];
      if (!base64pdf.includes("base64,")) {
        console.error(`❌ Skipping invalid PDF at index ${i}`);
        continue;
      }

      const base64Data = base64pdf.split(";base64,").pop();
      const buffer = Buffer.from(base64Data, "base64");

      try {
        const data = await pdf(buffer);
        const fileName = filenames?.[i] || `Document ${i + 1}`;
        combinedText += `\n\n--- START OF DOCUMENT ${i + 1}: ${fileName} ---\n${data.text}\n--- END OF DOCUMENT ${i + 1} ---\n`;
        console.log(`✅ Parsed ${fileName}, length: ${data.text.length}`);
      } catch (parseError) {
        console.error(`❌ Error parsing PDF ${i + 1}:`, parseError);
      }
    }

    const maxLength = 48000;
    if (combinedText.length > maxLength) {
      console.warn(`⚠️ Truncating combined text (${combinedText.length}) to ${maxLength}`);
      combinedText = combinedText.slice(0, maxLength);
    }

    if (!combinedText.trim()) {
      return res.status(500).json({ error: "No text extracted from PDFs." });
    }

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. You will receive several documents, each clearly labeled. Use all documents to answer the user's question. If the answer is not found, say so clearly.",
        },
        {
          role: "user",
          content: `DOCUMENTS:\n${combinedText}\n\nQUESTION:\n${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("❌ No usable response from OpenAI");
      return res.status(500).json({ error: "No answer returned from OpenAI." });
    }

    console.log("✅ Answer:", answer.slice(0, 200) + "...");
    res.json({ answer });
  } catch (error) {
    console.error("❌ Fatal error in /ask route:", error);
    res.status(500).json({ error: "Failed to process question." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
