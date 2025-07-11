const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let users = {}; // For testing only — replace with DB later

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "sortir_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// AUTH ROUTES
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (users[email]) {
    return res.status(400).json({ error: "Email already registered." });
  }
  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  req.session.user = email;
  res.json({ success: true });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  req.session.user = email;
  res.json({ success: true });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// AUTH GUARD
function ensureAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

// FILE ROUTES
app.post("/upload", ensureAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileExt = path.extname(req.file.originalname).toLowerCase();
  if (fileExt !== ".pdf") {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only PDF files are supported" });
  }
  const destPath = path.join(__dirname, "uploads", req.file.originalname);
  fs.rename(req.file.path, destPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to save file" });
    return res.json({ success: true });
  });
});

app.get("/files", ensureAuth, (req, res) => {
  const dirPath = path.join(__dirname, "uploads");
  fs.readdir(dirPath, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to list files" });
    res.json(files);
  });
});

app.delete("/delete/:filename", ensureAuth, (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.post("/ask", ensureAuth, async (req, res) => {
  const question = req.body.question;
  if (!question) return res.status(400).json({ error: "No question provided" });

  const files = fs.readdirSync(path.join(__dirname, "uploads"));
  let fullText = "";

  for (const file of files) {
    const filePath = path.join(__dirname, "uploads", file);
    const dataBuffer = fs.readFileSync(filePath);
    try {
      const data = await pdfParse(dataBuffer);
      fullText += `\n\n--- Content from ${file} ---\n\n` + data.text;
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant reading company documents to answer questions.",
        },
        {
          role: "user",
          content: `${question}\n\nDocuments:\n${fullText}`,
        },
      ],
      temperature: 0.2,
    });
    res.json({ answer: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.listen(port, () => {
  console.log(`Sortir server running on port ${port}`);
});
