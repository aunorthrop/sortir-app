const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const nodemailer = require("nodemailer");
require("dotenv").config();
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const USERS_FILE = path.join(__dirname, "users.json");
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  store: new MemoryStore({ checkPeriod: 86400000 }),
  secret: "sortir-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 86400000
  }
}));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -- AUTH --
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  if (users[email]) return res.status(400).json({ error: "Email already registered." });

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  saveUsers(users);
  req.session.user = email;

  // Send confirmation email
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Welcome to Sortir 🎉",
    text: "Thanks for signing up! You can now log in and start uploading your business files securely.",
  });

  res.json({ success: true });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
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

app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const users = loadUsers();
  if (!users[email]) return res.status(400).json({ error: "No account found." });

  const token = crypto.randomBytes(32).toString("hex");
  const expire = Date.now() + 1000 * 60 * 15;
  users[email].resetToken = token;
  users[email].resetExpire = expire;
  saveUsers(users);

  const resetLink = `${process.env.BASE_URL}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;
  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Sortir Password Reset",
    text: `Click the link to reset your password: ${resetLink}\nThis link expires in 15 minutes.`
  });

  res.json({ success: true });
});

app.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();
  const user = users[email];
  if (!user || user.resetToken !== token || Date.now() > user.resetExpire) {
    return res.status(400).json({ error: "Invalid or expired token." });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  users[email].password = hashed;
  delete users[email].resetToken;
  delete users[email].resetExpire;
  saveUsers(users);

  res.json({ success: true });
});

// -- FILE HANDLING --
function ensureAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, "uploads", req.session.user);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.post("/upload", ensureAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (path.extname(req.file.originalname).toLowerCase() !== ".pdf") {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only PDF files allowed" });
  }
  res.json({ success: true });
});

app.get("/files", ensureAuth, (req, res) => {
  const userDir = path.join(__dirname, "uploads", req.session.user);
  if (!fs.existsSync(userDir)) return res.json([]);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to list files" });
    res.json(files);
  });
});

app.delete("/delete/:filename", ensureAuth, (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.session.user, req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.post("/ask", ensureAuth, async (req, res) => {
  const question = req.body.question;
  if (!question) return res.status(400).json({ error: "No question provided" });

  const userDir = path.join(__dirname, "uploads", req.session.user);
  if (!fs.existsSync(userDir)) return res.status(400).json({ error: "No documents found." });

  const files = fs.readdirSync(userDir);
  let fullText = "";

  for (const file of files) {
    try {
      const filePath = path.join(userDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      if (!data.text.trim()) continue;
      fullText += `\n\n--- ${file} ---\n\n${data.text}`;
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err.message);
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant reading documents." },
        { role: "user", content: `${question}\n\nDocuments:\n${fullText}` }
      ],
      temperature: 0.2
    });

    res.json({ answer: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.listen(port, () => {
  console.log(`✅ Sortir server running on port ${port}`);
});
