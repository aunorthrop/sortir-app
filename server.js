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

// --- Middleware Setup ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key', // Use an environment variable for secrets
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
}));

// --- User Data Functions ---
const loadUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return {};
  const data = fs.readFileSync(USERS_FILE);
  return JSON.parse(data);
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// --- Authentication Middleware ---
const requireLogin = (req, res, next) => {
    if (!req.session.email) {
        return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
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
  
  // Automatically log in the user after signup
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

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out. Please try again.' });
    }
    res.clearCookie('connect.sid'); // Clears the session cookie
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });
});


// Forgot Password
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) {
      // Still send a success message to prevent user enumeration
      return res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  }

  const token = uuidv4();
  // Set an expiry for the token (e.g., 1 hour)
  users[email].resetToken = {
      value: token,
      expires: Date.now() + 3600000 // 1 hour in milliseconds
  };
  saveUsers(users);

  // Use your Render app's URL
  const resetLink = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, // Set your email in environment variables
      pass: process.env.GMAIL_APP_PASSWORD // The app password you generated
    }
  });

  const mailOptions = {
    from: `"Sortir App" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your Sortir Password Reset Request',
    html: `
        <p>Hi there,</p>
        <p>We received a request to reset your password. Click the link below to set a new one:</p>
        <p><a href="${resetLink}" style="color: #00e5ff; text-decoration: none;">Reset Your Password</a></p>
        <p>If you did not request this, you can safely ignore this email. This link will expire in 1 hour.</p>
        <p>Thanks,<br/>The Sortir Team</p>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('Send Mail Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send email. Please try again later.' });
    }
    res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  });
});


// Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  const users = loadUsers();
  const user = users[email];

  if (!user || !user.resetToken || user.resetToken.value !== token) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
  }

  if (user.resetToken.expires < Date.now()) {
      delete users[email].resetToken;
      saveUsers(users);
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  users[email].password = hashedPassword;
  delete users[email].resetToken; // Important: remove token after use
  saveUsers(users);

  res.status(200).json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
});


// --- Serve Frontend Pages ---
// These routes ensure users can't access pages directly without being logged in

app.get('/dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Fallback to index for root, login, etc.
app.get(['/', '/login', '/signup', '/forgot-password'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
