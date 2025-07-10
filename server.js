import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import pdfParse from "pdf-parse";
import { OpenAI } from "openai";
import path from "path";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(fileUpload());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const uploadedTexts = {};

app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).send("No PDF uploaded.");
  }

  const file = req.files.pdf;
  const fileName = file.name;

  try {
    const data = await pdfParse(file.data);
    uploadedTexts[fileName] = data.text;
    res.send({ success: true, fileName });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    res.status(500).send("Failed to read PDF.");
  }
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;
  const allText = Object.values(uploadedTexts).join("\n\n");

  if (!allText) {
    return res.status(400).send("No uploaded text found.");
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for retrieving business document information. Use only the provided content to answer.",
        },
        {
          role: "user",
          content: `Based on these documents:\n\n${allText}\n\nQuestion: ${question}`,
        },
      ],
    });

    res.send({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).send("Failed to get a response.");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
