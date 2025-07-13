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

// --- Persistent Disk Configuration for Render ---
// This path MUST match the "Mount Path" you configure in Render's "Disks" settings for your service.
// A common and safe path on Render for persistent storage is '/data'.
const PERSISTENT_DISK_MOUNT_PATH = "/data"; // <--- **IMPORTANT: Match this to your Render Disk Mount Path!**

// Paths for user data and uploads on the persistent disk
const userDir = path.join(PERSISTENT_DISK_MOUNT_PATH, "users");
const userFilePath = path.join(userDir, "users.json");
const UPLOADS_DIR = path.join(PERSISTENT_DISK_MOUNT_PATH, "uploads");

// Ensure the necessary persistent directories exist
if (!fs.existsSync(userDir)) {
  console.log(`Creating persistent user data directory: ${userDir}`);
  fs.mkdirSync(userDir, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  console.log(`Creating persistent uploads directory: ${UPLOADS_DIR}`);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// --- End Persistent Disk Configuration ---

// Configure Multer to save files to the persistent uploads directory
const upload = multer({ dest: UPLOADS_DIR });

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
    // For API routes, send a 401. For direct page access, redirect.
    if (req.originalUrl.startsWith("/api")) { // Example: If you use '/api' prefix for your backend calls
        res.status(401).json({ message: "Unauthorized. Please log in." });
    } else {
        res.status(401).redirect("/login.html");
    }
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
    // Clear cookie (optional, but good practice)
    res.clearCookie('connect.sid'); // Assuming default session cookie name
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
    // Use req.headers.origin for a more robust base URL in production
    // or set a fixed environment variable for your app's URL.
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
           Please click on the following link, or paste this into your browser to complete the process:\n\n
           ${req.headers.origin}/reset-password/${token}\n\n
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
    // If not a PDF, delete the temporarily uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting non-PDF file:", err);
    });
    return res.status(400).json({ error: "Only PDF files are supported" });
  }

  // Multer already saves it to UPLOADS_DIR with a temporary name.
  // We need to rename it to its original name within the same persistent directory.
  const oldPath = req.file.path; // This is the path to the temporary file in UPLOADS_DIR
  const newPath = path.join(UPLOADS_DIR, req.file.originalname);

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error("Failed to rename file:", err);
      // Attempt to delete the temporary file if rename failed
      fs.unlink(oldPath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temporary file after rename failure:", unlinkErr);
      });
      return res.status(500).json({ error: "Failed to save file" });
    }
    return res.json({ success: true, message: "File uploaded and saved successfully." });
  });
});

app.get("/files", isAuthenticated, (req, res) => {
  // Read from the persistent uploads directory
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
        console.error("Unable to list files from persistent directory:", err);
        return res.status(500).json({ error: "Unable to list files" });
    }
    res.json(files);
  });
});

app.delete("/delete/:filename", isAuthenticated, (req, res) => {
  // Delete from the persistent uploads directory
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
        console.error("Failed to delete file from persistent directory:", err);
        return res.status(500).json({ success: false, error: "Failed to delete file" });
    }
    res.json({ success: true, message: "File deleted successfully." });
  });
});

app.post("/ask", isAuthenticated, async (req, res) => {
  const question = req.body.question;
  if (!question) return res.status(400).json({ error: "No question provided" });

  let files = [];
  try {
    files = fs.readdirSync(UPLOADS_DIR); // Read from persistent uploads
  } catch (err) {
    console.error("Error reading uploads directory for AI question:", err);
    return res.status(500).json({ error: "Failed to access document files." });
  }

  let fullText = "";

  for (const file of files) {
    const filePath = path.join(UPLOADS_DIR, file); // Access from persistent uploads
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      fullText += `\n\n--- Content from ${file} ---\n\n` + data.text;
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }

  // If no documents were processed, inform the user
  if (fullText.trim() === "") {
      return res.status(400).json({ error: "No readable PDF documents found to answer your question." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant reading company documents to answer questions. Provide concise and accurate answers based *only* on the provided documents. If the answer is not in the documents, state that you cannot find the information.",
        },
        { role: "user", content: `${question}\n\nDocuments:\n${fullText}` },
      ],
      temperature: 0.2,
    });

    res.json({ answer: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI API request failed:", err);
    res.status(500).json({ error: "OpenAI request failed. Please try again later." });
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
