const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
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

// ✅ File-based session storage
app.use(session({
  store: new FileStore({
    path: "./sessions",       // will store JSON session files here
    ttl: 86400,               // session expires in 1 day
    retries: 1
  }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ... your signup, login, upload, ask, etc. routes go here ...
