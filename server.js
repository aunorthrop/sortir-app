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
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

// Path for user data on Render's persistent disk
const userDir = "/var/data/users";
const userFilePath = path.join(userDir, "users.json");

// Ensure the directory for user data exists
if (!fs.existsSync(userDir)) {
  fs.mkdirSync(userDir, { recursive: true });
}

const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Make sure to set this in your .env file
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" }, // Use secure cookies in production
  })
);

// Middleware to protect routes
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).redirect("/login.html");
  }
};

// Nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Helper function to read users from the file
const readUsers = () => {
  try {
    if (fs.existsSync(userFilePath)) {
      const usersJson = fs.readFileSync(userFilePath);
      return JSON.parse(usersJson);
    }
  } catch (error) {
    console.error("Error reading users file:", error);
  }
  return [];
};

// Helper function to write users to the file
const writeUsers = (users) => {
  try {
    fs.writeFileSync(userFilePath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Error writing to users file:", error);
  }
};

// --- Authentication Routes ---

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();

  if (users.find((user) => user.email === email)) {
    return res.status(400).json({ message: "User already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: Date.now().toString(), email, password: hashedPassword };
  users.push(newUser);
  writeUsers(users);

  res.status(201).json({ message: "User created successfully. Please login." });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find((user) => user.email === email);

  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = { id: user.id, email: user.email };
    res.json({ message: "Logged in successfully." });
  } else {
    res.status(401).json({ message: "Invalid email or password." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Could not log out." });
    }
    res.redirect("/login.html");
  });
});

app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const users = readUsers();
  const userIndex = users.findIndex((user) => user.email === email);

  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found." });
  }

  const token = crypto.randomBytes(20).toString("hex");
  const resetPasswordExpires = Date.now() + 3600000; // 1 hour

  users[userIndex].resetPasswordToken = token;
  users[userIndex].resetPasswordExpires = resetPasswordExpires;
  writeUsers(users);

  const mailOptions = {
    to: email,
    from: process.env.GMAIL_USER,
    subject: "Sortir Vault Password Reset",
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
           Please click on the following link, or paste this into your browser to complete the process:\n\n
           http://${req.headers.host}/reset-password/${token}\n\n
           If you did not request this, please ignore this email and your password will remain unchanged.\n`,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error("Error sending email:", err);
      return res.status(500).json({ message: "Error sending email." });
    }
    res.json({ message: `An e-mail has been sent to ${email} with further instructions.` });
  });
});

app.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const users = readUsers();
    const user = users.find(u => u.resetPasswordToken === token && u.resetPasswordExpires > Date.now());

    if (!user) {
        return res.status(400).send('Password reset token is invalid or has expired.');
    }

    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});


app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.resetPasswordToken === token && u.resetPasswordExpires > Date.now());

    if (userIndex === -1) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[userIndex].password = hashedPassword;
    users[userIndex].resetPasswordToken = undefined;
    users[userIndex].resetPasswordExpires = undefined;

    writeUsers(users);

    res.json({ message: 'Password has been reset successfully.' });
});

// --- Existing Application Routes (now protected) ---
app.get("/index.html", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/upload", isAuthenticated, upload.single("file"), async (req, res) => {
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

app.get("/files", isAuthenticated, (req, res) => {
  const dirPath = path.join(__dirname, "uploads");
  fs.readdir(dirPath, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to list files" });
    res.json(files);
  });
});

app.delete("/delete/:filename", isAuthenticated, (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.post("/ask", isAuthenticated, async (req, res) => {
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
          content:
            "You are a helpful assistant reading company documents to answer questions.",
        },
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

// Redirect root to login or index
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/index.html");
  } else {
    res.redirect("/login.html");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
