const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Session middleware with file store
app.use(session({
  store: new FileStore({ path: "./sessions" }),
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: true,
}));

app.use(express.static("public"));
app.use(express.json());

const usersFilePath = path.join(__dirname, "users.json");

function loadUsers() {
  if (!fs.existsSync(usersFilePath)) fs.writeFileSync(usersFilePath, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(usersFilePath));
}

function saveUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Signup route
app.post("/signup", (req, res) => {
  let body = "";
  req.on("data", chunk => body += chunk.toString());
  req.on("end", () => {
    const { email, password } = JSON.parse(body);
    const users = loadUsers();
    if (users[email]) return res.status(409).send("User already exists.");
    users[email] = { password };
    saveUsers(users);
    req.session.user = email;
    const userDir = path.join(__dirname, "uploads", email);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    res.status(200).send("Signup successful.");
  });
});

// Login route
app.post("/login", (req, res) => {
  let body = "";
  req.on("data", chunk => body += chunk.toString());
  req.on("end", () => {
    const { email, password } = JSON.parse(body);
    const users = loadUsers();
    if (!users[email] || users[email].password !== password) {
      return res.status(401).send("Invalid credentials.");
    }
    req.session.user = email;
    res.status(200).send("Login successful.");
  });
});

const upload = multer({ dest: "temp/" });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.session.user) return res.status(403).send("Unauthorized");
  const email = req.session.user;
  const userDir = path.join(__dirname, "uploads", email);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  const destPath = path.join(userDir, req.file.originalname);
  fs.rename(req.file.path, destPath, err => {
    if (err) return res.status(500).send("Error saving file.");
    res.status(200).send("File uploaded.");
  });
});

app.get("/files", (req, res) => {
  if (!req.session.user) return res.status(403).send("Unauthorized");
  const userDir = path.join(__dirname, "uploads", req.session.user);
  if (!fs.existsSync(userDir)) return res.json([]);
  const files = fs.readdirSync(userDir);
  res.json(files);
});

app.post("/delete", (req, res) => {
  if (!req.session.user) return res.status(403).send("Unauthorized");
  let body = "";
  req.on("data", chunk => body += chunk.toString());
  req.on("end", () => {
    const { filename } = JSON.parse(body);
    const filePath = path.join(__dirname, "uploads", req.session.user, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.status(200).send("File deleted.");
    } else {
      res.status(404).send("File not found.");
    }
  });
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/ask", async (req, res) => {
  if (!req.session.user) return res.status(403).send("Unauthorized");
  let body = "";
  req.on("data", chunk => body += chunk.toString());
  req.on("end", async () => {
    const { question } = JSON.parse(body);
    const userDir = path.join(__dirname, "uploads", req.session.user);
    if (!fs.existsSync(userDir)) return res.status(404).send("No documents found.");

    const files = fs.readdirSync(userDir);
    let combinedText = "";

    for (const file of files) {
      const filePath = path.join(userDir, file);
      const buffer = fs.readFileSync(filePath);
      try {
        const data = await pdfParse(buffer);
        combinedText += `\n---\n${file}:\n${data.text}`;
      } catch (err) {
        console.error(`Error parsing ${file}:`, err.message);
      }
    }

    try {
      const chat = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant that answers questions based on business documents." },
          { role: "user", content: `Docs:\n${combinedText}\n\nQuestion: ${question}` }
        ],
        temperature: 0.4,
      });
      res.json({ answer: chat.choices[0].message.content });
    } catch (error) {
      console.error("OpenAI Error:", error.message);
      res.status(500).send("Error generating response.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
