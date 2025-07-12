const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// --- Middleware Setup ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- User Data & Email Functions ---
const loadUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return {};
  const data = fs.readFileSync(USERS_FILE);
  return JSON.parse(data);
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
});

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(UPLOADS_DIR, req.session.email);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Authentication Middleware ---
const requireLogin = (req, res, next) => {
    if (!req.session.email) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    next();
};

// --- API Routes ---

// Signup
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const users = loadUsers();

    if (users[email]) {
        return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { password: hashedPassword, files: [] };
    saveUsers(users);

    // ✅ Send welcome email
    const mailOptions = {
        from: `"Sortir App" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Welcome to Sortir!',
        html: `<p>Hi there,</p><p>Thank you for creating an account with Sortir. You can now log in and start uploading your documents.</p><p>Thanks,<br/>The Sortir Team</p>`
    };
    transporter.sendMail(mailOptions);

    req.session.email = email;
    res.status(201).json({ success: true, message: 'Signup successful!' });
});


// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users[email];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  req.session.email = email;
  res.status(200).json({ success: true, message: 'Login successful.' });
});


// --- DASHBOARD API ---

// Upload a File
app.post('/api/upload', requireLogin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const users = loadUsers();
    // Add to file list if it's not already there
    if (!users[req.session.email].files.includes(req.file.originalname)) {
        users[req.session.email].files.push(req.file.originalname);
        saveUsers(users);
    }
    res.status(200).json({ success: true, message: 'File uploaded successfully.' });
});

// Get File List
app.get('/api/files', requireLogin, (req, res) => {
    const users = loadUsers();
    const userFiles = users[req.session.email]?.files || [];
    res.status(200).json({ success: true, files: userFiles });
});

// Delete a File
app.post('/api/delete-file', requireLogin, (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ success: false, message: 'Filename is required.' });
    }

    const users = loadUsers();
    const user = users[req.session.email];
    
    // Remove from user's file list
    const fileIndex = user.files.indexOf(filename);
    if (fileIndex > -1) {
        user.files.splice(fileIndex, 1);
        saveUsers(users);
    }

    // Delete the actual file from storage
    const filePath = path.join(UPLOADS_DIR, req.session.email, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    res.status(200).json({ success: true, message: 'File deleted.' });
});

// Ask a Question (Placeholder)
app.post('/api/ask', requireLogin, (req, res) => {
    const { question } = req.body;
    // In a real app, you'd process the documents and query OpenAI here.
    // For now, we'll just send a mock response.
    const mockResponse = `This is a mock AI response to your question: "${question}". Integrating with a real AI like GPT would provide a meaningful answer based on your uploaded documents.`;
    res.json({ success: true, answer: mockResponse });
});


// Other routes (logout, password reset) remain the same...

// --- Serve Frontend Pages ---
app.get('/dashboard.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Fallback to index for root pages
app.get(['/', '/login', '/signup', '/forgot-password'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ... existing /logout, /forgot-password, /reset-password routes
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out. Please try again.' });
    }
    res.clearCookie('connect.sid'); 
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) {
      return res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  }

  const token = uuidv4();
  users[email].resetToken = {
      value: token,
      expires: Date.now() + 3600000 
  };
  saveUsers(users);

  const resetLink = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;

  const mailOptions = {
    from: `"Sortir App" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your Sortir Password Reset Request',
    html: `<p>Click the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link will expire in 1 hour.</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return res.status(500).json({ success: false, message: 'Failed to send email.' });
    }
    res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();
  const user = users[email];

  if (!user || !user.resetToken || user.resetToken.value !== token || user.resetToken.expires < Date.now()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  users[email].password = hashedPassword;
  delete users[email].resetToken;
  saveUsers(users);

  res.status(200).json({ success: true, message: 'Password has been reset successfully.' });
});


app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
