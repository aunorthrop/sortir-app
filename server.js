const express = require("express");
const multer = require("multer");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 10000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new FileStore({}),
    secret: "sortir-secret",
    resave: false,
    saveUninitialized: false,
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, "uploads", req.session.user);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

const users = {}; // In-memory user store: { email: password }

app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  if (users[email]) return res.status(409).send("User exists");
  users[email] = password;
  req.session.user = email;
  res.sendStatus(200);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (users[email] !== password) return res.status(401).send("Invalid credentials");
  req.session.user = email;
  res.sendStatus(200);
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");
  res.sendStatus(200);
});

app.get("/files", (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");
  const userDir = path.join(__dirname, "uploads", req.session.user);
  if (!fs.existsSync(userDir)) return res.json([]);
  const files = fs.readdirSync(userDir);
  res.json(files);
});

app.post("/ask", async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");
  const userDir = path.join(__dirname, "uploads", req.session.user);
  const files = fs.existsSync(userDir) ? fs.readdirSync(userDir) : [];

  let combinedText = "";
  for (const file of files) {
    const filePath = path.join(userDir, file);
    const data = await pdfParse(fs.readFileSync(filePath)).catch(() => null);
    if (data) combinedText += data.text + "\n";
  }

  const prompt = `The user asked: "${req.body.question}"\n\nBased on these documents:\n${combinedText}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  res.json({ answer: completion.choices[0].message.content.trim() });
});

app.listen(port, () => {
  console.log(`✅ Sortir running on port ${port}`);
});
