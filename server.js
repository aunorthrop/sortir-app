// server.js

const express = require('express');
const bodyParser = require('body-parser'); // Assuming you use this
const cookieParser = require('cookie-parser'); // Assuming you use this
const session = require('express-session'); // Assuming you use this
const multer = require('multer'); // For file uploads
const nodemailer = require('nodemailer'); // For sending emails
const bcrypt = require('bcrypt'); // For password hashing
const fs = require('fs'); // For file system operations (users.json, files)
const path = require('path'); // For path manipulation
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs (reset tokens)
const OpenAI = require('openai'); // For OpenAI API integration

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for port, default to 3000

// --- Middleware Setup ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // IMPORTANT: Use a strong, random secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Nodemailer Transporter Setup ---
// Ensure EMAIL_USER and EMAIL_PASS environment variables are set on Render
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or 'smtp' and host/port for other providers
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // This should be your Gmail App Password
    }
});

// --- OpenAI Client Setup ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure this env var is set on Render
});

// --- User Data Handling (users.json) ---
const USERS_FILE = path.join(__dirname, 'users.json');

const loadUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, return an empty object
            return {};
        }
        console.error('Error loading users.json:', error);
        return {}; // Return empty object on other errors
    }
};

const saveUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving users.json:', error);
    }
};

// --- File Upload Setup (Multer) ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
// Create the uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // You might want to prepend a user ID or hash for unique filenames
        // and to associate files with users in a real app
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });


// --- ROUTES ---

// Redirect root to index.html (login/signup page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Example protected route (dashboard)
app.get('/dashboard.html', (req, res) => {
    // In a real app, you'd check req.session.userId here
    // If not authenticated, redirect to login: res.redirect('/')
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Forgot password page
app.get('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// Your forgot password API route (from your snippet)
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) {
      // To prevent user enumeration, send a success message even if the user doesn't exist.
      return res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  }

  const token = uuidv4();
  users[email].resetToken = {
      value: token,
      expires: Date.now() + 3600000 // Token expires in 1 hour
  };
  saveUsers(users);

  // IMPORTANT: Ensure this URL matches your deployed Render URL
  // e.g., 'https://your-app-name.onrender.com/reset-password.html'
  const resetLink = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;

  const mailOptions = {
    from: `"Sortir App" <${process.env.EMAIL_USER}>`, // Use EMAIL_USER here
    to: email,
    subject: 'Your Sortir Password Reset Request',
    html: `<p>Hi there,</p><p>We received a request to reset your password. Click the link below to set a new one:</p><p><a href="${resetLink}" style="color: #00e5ff; text-decoration: none;">Reset Your Password</a></p><p>If you did not request this, you can safely ignore this email. This link will expire in 1 hour.</p><p>Thanks,<br/>The Sortir Team</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('Nodemailer Error:', error);
        // Do not expose sensitive error details to client in production
        return res.status(500).json({ success: false, message: 'Failed to send email. Please check server logs.' });
    }
    res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  });
});

// --- Other API Routes (Login, Signup, Upload, Ask, Delete, etc.) would go here ---

// Login Route Example (simplified)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const users = loadUsers();

    if (!users[email]) {
        return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    try {
        const isMatch = await bcrypt.compare(password, users[email].password);
        if (isMatch) {
            req.session.userId = email; // Store user ID in session
            return res.status(200).json({ success: true, message: 'Logged in successfully.', redirect: '/dashboard.html' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// Signup Route Example (simplified)
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    const users = loadUsers();

    if (users[email]) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users[email] = {
            password: hashedPassword,
            resetToken: null,
            files: []
        };
        saveUsers(users);
        req.session.userId = email; // Log user in immediately after signup
        res.status(201).json({ success: true, message: 'Account created successfully!', redirect: '/dashboard.html' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error during signup.' });
    }
});


// Upload API Route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    // In a real app, you'd associate this file with the logged-in user
    // e.g., req.session.userId, then add filename to users[req.session.userId].files
    const users = loadUsers();
    const userId = req.session.userId; // Assuming user is logged in and session has userId

    if (userId && users[userId]) {
        if (!users[userId].files.includes(req.file.filename)) {
            users[userId].files.push(req.file.filename);
            saveUsers(users);
        }
        res.status(200).json({ success: true, message: 'File uploaded successfully!', filename: req.file.filename });
    } else {
        // If no user is logged in, perhaps save to a temp folder or reject
        fs.unlinkSync(req.file.path); // Delete the uploaded file if no user context
        res.status(401).json({ success: false, message: 'Unauthorized: Please log in to upload files.' });
    }
});

// Get Files API Route
app.get('/api/files', (req, res) => {
    // In a real app, you'd fetch files specific to the logged-in user
    const userId = req.session.userId;
    const users = loadUsers();

    if (userId && users[userId]) {
        // Filter files that actually exist on disk if necessary,
        // or just return the list from user's data
        const userFiles = users[userId].files.filter(filename => fs.existsSync(path.join(UPLOAD_DIR, filename)));
        res.status(200).json({ success: true, files: userFiles });
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized: Please log in to view files.' });
    }
});

// Delete File API Route
app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    const userId = req.session.userId;
    const users = loadUsers();

    if (!userId || !users[userId]) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Please log in to delete files.' });
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    if (fs.existsSync(filePath) && users[userId].files.includes(filename)) {
        try {
            fs.unlinkSync(filePath); // Delete file from disk
            // Remove file from user's list
            users[userId].files = users[userId].files.filter(f => f !== filename);
            saveUsers(users);
            res.status(200).json({ success: true, message: `File ${filename} deleted.` });
        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).json({ success: false, message: 'Failed to delete file on server.' });
        }
    } else {
        res.status(404).json({ success: false, message: 'File not found or not associated with your account.' });
    }
});


// Ask API Route (OpenAI Integration)
app.post('/api/ask', async (req, res) => {
    const { question } = req.body;
    // In a real app, you'd ideally pass document content for the AI to answer from
    // For now, it's a general question to OpenAI
    if (!question) {
        return res.status(400).json({ success: false, message: 'Question is required.' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Or "gpt-4" if you have access and need
            messages: [{ role: "user", content: question }],
        });
        const answer = completion.choices[0].message.content;
        res.status(200).json({ success: true, answer: answer });
    } catch (error) {
        console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to get an answer from Sortir AI.' });
    }
});


// Logout Route
app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ success: false, message: 'Failed to log out.' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.redirect('/'); // Redirect to login page
    });
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
