app.post("/ask", async (req, res) => {
  try {
    const { question, pdfs } = req.body;

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
        console.log(`✅ Extracted text from PDF ${i + 1}, length: ${data.text.length}`);
        combinedText += "\n\n" + data.text;
      } catch (parseError) {
        console.error(`❌ Error parsing PDF ${i + 1}:`, parseError);
      }
    }

    const maxLength = 48000;
    if (combinedText.length > maxLength) {
      console.warn(`⚠️ Combined text too long (${combinedText.length}), truncating to ${maxLength}`);
      combinedText = combinedText.slice(0, maxLength);
    }

    if (!combinedText.trim()) {
      console.error("❌ No usable text extracted from any PDFs");
      return res.status(500).json({ error: "Could not extract text from PDFs." });
    }

    console.log("🧠 Sending to OpenAI...");

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
      console.error("❌ No usable response from OpenAI. Full response:", JSON.stringify(chatCompletion, null, 2));
      return res.status(500).json({ error: "No answer returned from OpenAI." });
    }

    console.log("✅ Answer from OpenAI:", answer.slice(0, 200) + "...");
    res.json({ answer });
  } catch (error) {
    console.error("❌ Fatal error in /ask route:", error);
    res.status(500).json({ error: "Failed to process question." });
  }
});
