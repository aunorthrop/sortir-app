const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");
require("dotenv").config();
const { OpenAI } = require("openai");
const bcrypt = require("bcrypt");
const session = require("express-session");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const app = express();
const port = process.env.PORT || 3000;

const adapter = new FileSync("users/db.json");
const db = low(adapter);
db.defaults({ users: [], files: {} }).write();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "sortir_secret",
  resave: false,
  saveUninitialized: false,
}));

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(403).json({ error: "Not logged in" });
  next();
}

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (db.get("users").find({ email }).value()) {
    return res.status(400).json({ error: "Email already registered" });
  }
  const hashed = await bcrypt.hash(password, 10);
  const id = Date.now().toString();
  db.get("users").push({ id, email, password: hashed }).write();
  res.json({ success: true });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.get("users").find({ email }).value();
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  req.session.userId = user.id;
  res.json({ success: true });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileExt = path.extname(req.file.originalname).toLowerCase();
  if (fileExt !== ".pdf") {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only PDF files are supported" });
  }

  const filename = `${Date.now()}_${req.file.originalname}`;
  const destPath = path.join(__dirname, "uploads", filename);
  fs.rename(req.file.path, destPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to save file" });

    const userId = req.session.userId;
    const fileList = db.get("files").get(userId).value() || [];
    db.get("files").set(userId, [...fileList, filename]).write();
    return res.json({ success: true });
  });
});

app.get("/files", requireLogin, (req, res) => {
  const userId = req.session.userId;
  const userFiles = db.get("files").get(userId).value() || [];
  res.json(userFiles);
});

app.delete("/delete/:filename", requireLogin, (req, res) => {
  const userId = req.session.userId;
  const filename = req.params.filename;

  const userFiles = db.get("files").get(userId).value() || [];
  const filePath = path.join(__dirname, "uploads", filename);

  if (!userFiles.includes(filename)) {
    return res.status(403).json({ error: "Unauthorized delete" });
  }

  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });

    db.get("files").set(userId, userFiles.filter(f => f !== filename)).write();
    res.json({ success: true });
  });
});

app.post("/ask", requireLogin, async (req, res) => {
  const question = req.body.question;
  const userId = req.session.userId;
  const userFiles = db.get("files").get(userId).value() || [];

  let fullText = "";
  for (const file of userFiles) {
    const filePath = path.join(__dirname, "uploads", file);
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      fullText += `\n\n--- Content from ${file} ---\n\n` + data.text;
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant reading company documents to answer questions." },
        { role: "user", content: `${question}\n\nDocuments:\n${fullText}` },
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
  console.log(`Server running on port ${port}`);
});
