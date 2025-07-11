const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const session = require("express-session");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 10000;

const users = {};
const uploads = {};

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "sortir-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Email sender setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// -------- ROUTES --------

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (users[email]) return res.status(400).json({ error: "Email already in use" });

  const hashed = await bcrypt.hash(password, 10);
  users[email] = { password: hashed };
  uploads[email] = [];

  req.session.email = email;

  // Send confirmation email
  await transporter.sendMail({
    from: process.env.GMAIL_EMAIL,
    to: email,
    subject: "Welcome to Sortir",
    text: "Thanks for signing up! Your Sortir account is ready.",
  });

  res.sendStatus(200);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  req.session.email = email;
  res.sendStatus(200);
});

app.get("/session", (req, res) => {
  if (req.session.email) return res.json({ loggedIn: true, email: req.session.email });
  res.json({ loggedIn: false });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const email = req.session.email;
  if (!email) return res.status(401).end();

  const buffer = fs.readFileSync(req.file.path);
  const data = await pdfParse(buffer);
  uploads[email].push({ name: req.file.originalname, content: data.text });
  res.sendStatus(200);
});

app.get("/files", (req, res) => {
  const email = req.session.email;
  if (!email || !uploads[email]) return res.json([]);
  res.json(uploads[email].map(f => f.name));
});

app.post("/delete/:name", (req, res) => {
  const email = req.session.email;
  if (!email || !uploads[email]) return res.sendStatus(401);

  uploads[email] = uploads[email].filter(f => f.name !== req.params.name);
  res.sendStatus(200);
});

app.post("/ask", async (req, res) => {
  const email = req.session.email;
  if (!email || !uploads[email]) return res.sendStatus(401);

  const question = req.body.question;
  const context = uploads[email].map(f => f.content).join("\n").slice(0, 8000); // keep prompt short

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You answer based only on the uploaded documents." },
      { role: "user", content: `${context}\n\nQuestion: ${question}` },
    ],
  });

  res.json({ answer: completion.choices[0].message.content });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
