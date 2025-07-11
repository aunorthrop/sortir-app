const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const nodemailer = require("nodemailer");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new FileStore({ path: "./sessions" }),
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

const userDB = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const upload = multer({ dest: "uploads/" });

app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  if (userDB[email]) {
    return res.status(409).send("Email already in use.");
  }
  userDB[email] = password;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to ShortGear!",
    text: "Thank you for signing up.",
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("Email error:", err);
    else console.log("Confirmation sent:", info.response);
  });

  req.session.user = email;
  res.sendStatus(200);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (userDB[email] === password) {
    req.session.user = email;
    res.sendStatus(200);
  } else {
    res.status(401).send("Invalid credentials.");
  }
});

app.get("/check-session", (req, res) => {
  if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
  else res.json({ loggedIn: false });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const userDir = path.join(__dirname, "uploads", req.session.user || "default");
  fs.mkdirSync(userDir, { recursive: true });

  const filePath = path.join(userDir, req.file.originalname);
  fs.renameSync(req.file.path, filePath);

  res.sendStatus(200);
});

app.get("/files", (req, res) => {
  const userDir = path.join(__dirname, "uploads", req.session.user || "default");
  if (!fs.existsSync(userDir)) return res.json([]);
  const files = fs.readdirSync(userDir);
  res.json(files);
});

app.delete("/delete/:file", (req, res) => {
  const userDir = path.join(__dirname, "uploads", req.session.user || "default");
  const filePath = path.join(userDir, req.params.file);
  fs.unlinkSync(filePath);
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
