const express = require(“express”);
const multer = require(“multer”);
const fs = require(“fs”);
const path = require(“path”);
const pdfParse = require(“pdf-parse”);
const cors = require(“cors”);
const bcrypt = require(“bcryptjs”);
const session = require(“express-session”);
const SQLiteStore = require(“connect-sqlite3”)(session);
const sqlite3 = require(“sqlite3”).verbose();
require(“dotenv”).config();
const { OpenAI } = require(“openai”);

const app = express();
const port = process.env.PORT || 3000;

// Initialize SQLite database
const db = new sqlite3.Database(“sortir_vault.db”);

// Create users table if it doesn’t exist
db.serialize(() => {
db.run(`CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP )`);
});

// Session configuration
app.use(session({
store: new SQLiteStore({
db: ‘sessions.db’,
dir: ‘./data’
}),
secret: process.env.SESSION_SECRET || ‘your-secret-key-change-this-in-production’,
resave: false,
saveUninitialized: false,
cookie: {
secure: false, // Set to true in production with HTTPS
httpOnly: true,
maxAge: 24 * 60 * 60 * 1000 // 24 hours
}
}));

const upload = multer({ dest: “uploads/” });
app.use(cors());
app.use(express.json());
app.use(express.static(“public”));

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

// Authentication middleware
const requireAuth = (req, res, next) => {
if (req.session.userId) {
next();
} else {
res.status(401).json({ error: “Authentication required” });
}
};

// Authentication routes
app.post(”/auth/signup”, async (req, res) => {
const { name, email, password } = req.body;

if (!name || !email || !password) {
return res.status(400).json({ error: “All fields are required” });
}

if (password.length < 6) {
return res.status(400).json({ error: “Password must be at least 6 characters” });
}

try {
const hashedPassword = await bcrypt.hash(password, 10);

```
db.run(
  "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
  [name, email, hashedPassword],
  function(err) {
    if (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(400).json({ error: "Email already exists" });
      }
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json({ success: true, message: "User created successfully" });
  }
);
```

} catch (error) {
console.error(“Signup error:”, error);
res.status(500).json({ error: “Server error” });
}
});

app.post(”/auth/login”, (req, res) => {
const { email, password } = req.body;

if (!email || !password) {
return res.status(400).json({ error: “Email and password are required” });
}

db.get(“SELECT * FROM users WHERE email = ?”, [email], async (err, user) => {
if (err) {
console.error(“Database error:”, err);
return res.status(500).json({ error: “Database error” });
}

```
if (!user) {
  return res.status(401).json({ error: "Invalid credentials" });
}

try {
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
} catch (error) {
  console.error("Login error:", error);
  res.status(500).json({ error: "Server error" });
}
```

});
});

app.post(”/auth/logout”, (req, res) => {
req.session.destroy((err) => {
if (err) {
console.error(“Logout error:”, err);
return res.status(500).json({ error: “Logout failed” });
}
res.json({ success: true });
});
});

app.get(”/auth/status”, (req, res) => {
if (req.session.userId) {
res.json({
authenticated: true,
user: {
id: req.session.userId,
name: req.session.userName,
email: req.session.userEmail
}
});
} else {
res.json({ authenticated: false });
}
});

// Protected routes (require authentication)
app.post(”/upload”, requireAuth, upload.single(“file”), async (req, res) => {
if (!req.file) return res.status(400).json({ error: “No file uploaded” });

const fileExt = path.extname(req.file.originalname).toLowerCase();
if (fileExt !== “.pdf”) {
fs.unlinkSync(req.file.path);
return res.status(400).json({ error: “Only PDF files are supported” });
}

// Create user-specific upload directory
const userDir = path.join(__dirname, “uploads”, req.session.userId.toString());
if (!fs.existsSync(userDir)) {
fs.mkdirSync(userDir, { recursive: true });
}

const destPath = path.join(userDir, req.file.originalname);
fs.rename(req.file.path, destPath, (err) => {
if (err) return res.status(500).json({ error: “Failed to save file” });
return res.json({ success: true });
});
});

app.get(”/files”, requireAuth, (req, res) => {
const userDir = path.join(__dirname, “uploads”, req.session.userId.toString());

if (!fs.existsSync(userDir)) {
return res.json([]);
}

fs.readdir(userDir, (err, files) => {
if (err) return res.status(500).json({ error: “Unable to list files” });
res.json(files);
});
});

app.delete(”/delete/:filename”, requireAuth, (req, res) => {
const userDir = path.join(__dirname, “uploads”, req.session.userId.toString());
const filePath = path.join(userDir, req.params.filename);

// Security check: ensure file is in user’s directory
if (!filePath.startsWith(userDir)) {
return res.status(403).json({ error: “Access denied” });
}

fs.unlink(filePath, (err) => {
if (err) return res.status(500).json({ success: false });
res.json({ success: true });
});
});

app.post(”/ask”, requireAuth, async (req, res) => {
const question = req.body.question;
if (!question) return res.status(400).json({ error: “No question provided” });

const userDir = path.join(__dirname, “uploads”, req.session.userId.toString());

if (!fs.existsSync(userDir)) {
return res.status(400).json({ error: “No files uploaded yet” });
}

const files = fs.readdirSync(userDir);
let fullText = “”;

for (const file of files) {
const filePath = path.join(userDir, file);
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
model: “gpt-4”,
messages: [
{ role: “system”, content: “You are a helpful assistant reading company documents to answer questions.” },
{ role: “user”, content: `${question}\n\nDocuments:\n${fullText}` },
],
temperature: 0.2,
});

```
res.json({ answer: completion.choices[0].message.content.trim() });
```

} catch (err) {
console.error(err);
res.status(500).json({ error: “OpenAI request failed” });
}
});

app.listen(port, () => {
console.log(`Server running on port ${port}`);
});
