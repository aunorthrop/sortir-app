const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");
require("dotenv").config();
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
  if (req.session && req.session.email) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  } else {
    res.redirect("/login.html");
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/upload", upload.single("file"), async (req, res) => {
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

app.get("/files", (req, res) => {
  const dirPath = path.join(__dirname, "uploads");
  fs.readdir(dirPath, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to list files" });
    res.json(files);
  });
});

app.delete("/delete/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.post("/ask", async (req, res) => {
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
const session = require("express-session");
app.use(session({
  secret: "sortir_secret_key",
  resave: false,
  saveUninitialized: true,
}));

const USERS_FILE = path.join(__dirname, "data", "users.json");
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));

const loadUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (data) => fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));

app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(400).send("Email already registered.");
  users[email] = { password };
  saveUsers(users);
  req.session.user = email;
  res.redirect("/index.html");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (!users[email] || users[email].password !== password) {
    return res.status(401).send("Invalid credentials.");
  }
  req.session.user = email;
  res.redirect("/index.html");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
