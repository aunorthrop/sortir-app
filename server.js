const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const cors = require("cors");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(fileUpload());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).send("No file uploaded.");
  }

  const pdfFile = req.files.pdf;
  const filePath = path.join(uploadsDir, pdfFile.name);

  try {
    await pdfFile.mv(filePath);
    res.send("File uploaded!");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed.");
  }
});

app.get("/list", (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error("List error:", err);
      return res.status(500).send("Failed to list files.");
    }
    res.json(files);
  });
});

app.post("/delete", (req, res) => {
  const filename = req.body.filename;
  const filePath = path.join(uploadsDir, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Delete error:", err);
      return res.status(500).send("Failed to delete file.");
    }
    res.send("File deleted!");
  });
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;
  const files = fs.readdirSync(uploadsDir);

  let combinedText = "";

  for (const file of files) {
    try {
      const filePath = path.join(uploadsDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      combinedText += `\n---\n${file}:\n${pdfData.text}`;
    } catch (err) {
      console.error(`Error parsing ${file}:`, err.message);
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based only on the provided document text.",
        },
        {
          role: "user",
          content: `Here are the documents:\n${combinedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.2,
    });

    res.json({ answer: response.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).send("Failed to generate answer.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
