const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(express.static(path.join(__dirname, 'public')));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const USERS_FILE = path.join(__dirname, 'users.json');

const loadUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Routes

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    const users = loadUsers();

    if (users[email]) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users[email] = { password: hashedPassword, resetToken: null, files: [] };
        saveUsers(users);
        req.session.userId = email;
        res.status(201).json({ success: true, message: 'Account created successfully!', redirect: '/dashboard.html' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during signup.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const users = loadUsers();

    if (!users[email]) {
        return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    try {
        const isMatch = await bcrypt.compare(password, users[email].password);
        if (isMatch) {
            req.session.userId = email;
            res.status(200).json({ success: true, message: 'Logged in successfully.', redirect: '/dashboard.html' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
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
        from: `"Sortir App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Sortir Password Reset Request',
        html: `<p>Hi there,</p><p>We received a request to reset your password. Click the link below to set a new one:</p><p><a href="${resetLink}" style="color: #00e5ff; text-decoration: none;">Reset Your Password</a></p><p>If you did not request this, you can safely ignore this email. This link will expire in 1 hour.</p><p>Thanks,<br/>The Sortir Team</p>`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
        }
        res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    const users = loadUsers();

    if (!email || !token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const user = users[email];
    if (!user || !user.resetToken) {
        return res.status(400).json({ success: false, message: 'Invalid reset request.' });
    }

    const tokenValid = user.resetToken.value === token && Date.now() < user.resetToken.expires;
    if (!tokenValid) {
        return res.status(400).json({ success: false, message: 'Reset token is invalid or expired.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users[email].password = hashedPassword;
        users[email].resetToken = null;
        saveUsers(users);
        res.status(200).json({ success: true, message: 'Password reset successful. You can now log in.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error resetting password.' });
    }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    const users = loadUsers();
    const userId = req.session.userId;

    if (!req.file || !userId || !users[userId]) {
        return res.status(401).json({ success: false, message: 'Unauthorized or no file uploaded.' });
    }

    if (!users[userId].files.includes(req.file.filename)) {
        users[userId].files.push(req.file.filename);
        saveUsers(users);
    }

    res.status(200).json({ success: true, message: 'File uploaded successfully!', filename: req.file.filename });
});

app.get('/api/files', (req, res) => {
    const userId = req.session.userId;
    const users = loadUsers();

    if (!userId || !users[userId]) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const userFiles = users[userId].files.filter(filename =>
        fs.existsSync(path.join(UPLOAD_DIR, filename))
    );

    res.status(200).json({ success: true, files: userFiles });
});

app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    const userId = req.session.userId;
    const users = loadUsers();

    if (!userId || !users[userId]) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    if (fs.existsSync(filePath) && users[userId].files.includes(filename)) {
        try {
            fs.unlinkSync(filePath);
            users[userId].files = users[userId].files.filter(f => f !== filename);
            saveUsers(users);
            res.status(200).json({ success: true, message: `File ${filename} deleted.` });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to delete file.' });
        }
    } else {
        res.status(404).json({ success: false, message: 'File not found.' });
    }
});

app.post('/api/ask', async (req, res) => {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ success: false, message: 'Question is required.' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: question }]
        });

        const answer = completion.choices[0].message.content;
        res.status(200).json({ success: true, answer });
    } catch (error) {
        res.status(500).json({ success: false, message: 'OpenAI error.' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed.' });
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
