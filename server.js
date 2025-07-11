const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const bcrypt = require("bcrypt");
const session = require("express-session");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const usersFilePath = path.join(__dirname, "users.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: "sortir_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

const upload = multer({ dest: "temp/" });

// Ensure users.json exists
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, "{}");
}

function getUserDir(email) {
  return path.join(__dirname, "uploads", Buffer.from(email).toString("hex"));
}

// Signup
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFilePath));

  if (users[email]) {
    return res.status(400).json({ message: "Email already registered" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { password: hashedPassword };
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

    // Create user folder
    const userDir = getUserDir(email);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    // Send confirmation email
    await transporter.sendMail({
      from: `"Sortir" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Sortir!",
      text: `Hello ${email}, your account has been created successfully.`,
    });

    req.session.email = email;
    res.status(200).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Signup failed:", error);
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFilePath));
  const user = users[email];

  if (!user) return res.status(400).json({ message: "Account not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Incorrect password" });

  req.session.email = email;
  res.status(200).json({ message: "Login successful" });
});

// Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(403).json({ error: "Not logged in" });

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== ".pdf") {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only PDF files allowed" });
  }

  const userDir = getUserDir(email);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  const destPath = path.join(userDir, req.file.originalname);
  fs.rename(req.file.path, destPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to save file" });
    res.json({ success: true });
  });
});

// Get files
app.get("/files", (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(403).json({ error: "Not logged in" });

  const userDir = getUserDir(email);
  if (!fs.existsSync(userDir)) return res.json([]);

  fs.readdir(userDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to list files" });
    res.json(files);
  });
});

// Delete
app.delete("/delete/:filename", (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(403).json({ error: "Not logged in" });

  const filePath = path.join(getUserDir(email), req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// Ask
app.post("/ask", async (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(403).json({ error: "Not logged in" });

  const question = req.body.question;
  if (!question) return res.status(400).json({ error: "No question provided" });

  const files = fs.readdirSync(getUserDir(email));
  let fullText = "";

  for (const file of files) {
    const filePath = path.join(getUserDir(email), file);
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      fullText += `\n\n--- Content from ${file} ---\n\n` + data.text;
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant reading uploaded company PDFs to answer questions." },
        { role: "user", content: `${question}\n\nDocuments:\n${fullText}` }
      ],
      temperature: 0.2,
    });

    res.json({ answer: response.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
