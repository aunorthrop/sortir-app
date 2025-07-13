// server.js

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const bcrypt = require('bcryptjs'); // Corrected import to bcryptjs
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const SQLiteStore = require('connect-sqlite3')(session); // Import SQLite session store

// --- Database Setup (SQLite) ---
const DB_FILE_PATH = process.env.DB_FILE_PATH || './data/database.db'; // Default for local dev
const SESSION_DB_PATH = process.env.SESSION_DB_PATH || './data/sessions.db'; // For session store

// Ensure the directory for databases exists
const fs = require('fs');
const path = require('path');
const dataDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Open SQLite database for user data
const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
        console.error('Error connecting to the user database:', err.message);
    } else {
        console.log('Connected to the user database (SQLite).');
        // Create users table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )`);
        console.log('Users table checked/created.');
    }
});

// Initialize Passport
const initializePassport = require('./passport-config');
initializePassport(
  passport,
  async (email) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
);

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // or 'smtp.example.com' for other services
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // Use an App Password for Gmail
    }
});

// --- Middleware ---
app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({
    db: 'sessions.db', // Name of the session database file
    dir: path.dirname(SESSION_DB_PATH), // Directory where sessions.db will be created (e.g., /var/data)
    table: 'sessions' // Table name for sessions
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.static('public')); // Serve static files from 'public' directory

// --- Routes ---

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs', { name: req.user.name });
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs');
});

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs');
});

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const id = Date.now().toString(); // Simple unique ID for now

    db.run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, req.body.name, req.body.email, hashedPassword],
      function(err) {
        if (err) {
          console.error('Error inserting user:', err.message);
          if (err.message.includes('UNIQUE constraint failed: users.email')) {
            req.flash('error', 'Email already registered. Please login or use a different email.');
          } else {
            req.flash('error', 'Registration failed. Please try again.');
          }
          return res.redirect('/register');
        }
        console.log(`User ${req.body.email} registered with ID: ${id}`);
        req.flash('success', 'Registration successful! You can now log in.');
        res.redirect('/login');
      });

  } catch (e) {
    console.error('Error during registration:', e);
    req.flash('error', 'An error occurred during registration.');
    res.redirect('/register');
  }
});

// --- Logout Route ---
app.delete('/logout', (req, res) => {
  req.logOut((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.redirect('/'); // Or handle error appropriately
    }
    req.flash('success', 'You have been logged out.');
    res.redirect('/login');
  });
});

// --- Forgot Password Routes ---
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password.ejs');
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error:', err.message);
            req.flash('error', 'An error occurred. Please try again later.');
            return res.redirect('/forgot-password');
        }
        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot-password');
        }

        // Generate a reset token (simple for now, in a real app use a more robust method like JWT)
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const resetExpires = Date.now() + 3600000; // 1 hour from now

        // Store reset token and expiry in the database (add columns to users table if not present)
        // You'll need to modify your 'users' table schema:
        // ALTER TABLE users ADD COLUMN resetPasswordToken TEXT;
        // ALTER TABLE users ADD COLUMN resetPasswordExpires INTEGER;

        db.run('UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
            [resetToken, resetExpires, user.id], async function(updateErr) {
                if (updateErr) {
                    console.error('Error updating user with reset token:', updateErr.message);
                    req.flash('error', 'Could not set reset token. Please try again.');
                    return res.redirect('/forgot-password');
                }

                const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

                const mailOptions = {
                    to: user.email,
                    from: process.env.GMAIL_USER, // Your verified sender email
                    subject: 'Password Reset',
                    html: `
                        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                        <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                        <a href="${resetUrl}">${resetUrl}</a>
                        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                        <p>This link is valid for 1 hour.</p>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    req.flash('success', 'An email has been sent to ' + user.email + ' with instructions.');
                    res.redirect('/login');
                } catch (emailErr) {
                    console.error('Error sending password reset email:', emailErr);
                    req.flash('error', 'Error sending email. Please check your email configuration.');
                    res.redirect('/forgot-password');
                }
            });
    });
});

app.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;

    db.get('SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
        [token, Date.now()], (err, user) => {
            if (err) {
                console.error('Database error:', err.message);
                req.flash('error', 'An error occurred. Please try again later.');
                return res.redirect('/login');
            }
            if (!user) {
                req.flash('error', 'Password reset token is invalid or has expired.');
                return res.redirect('/login');
            }
            res.render('reset-password.ejs', { token: token, messages: req.flash() });
        });
});

app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.');
        return res.redirect(`/reset-password/${token}`);
    }

    db.get('SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?',
        [token, Date.now()], async (err, user) => {
            if (err) {
                console.error('Database error:', err.message);
                req.flash('error', 'An error occurred. Please try again later.');
                return res.redirect('/login');
            }
            if (!user) {
                req.flash('error', 'Password reset token is invalid or has expired.');
                return res.redirect('/login');
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                db.run('UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
                    [hashedPassword, user.id], function(updateErr) {
                        if (updateErr) {
                            console.error('Error updating password:', updateErr.message);
                            req.flash('error', 'Could not update password. Please try again.');
                            return res.redirect(`/reset-password/${token}`);
                        }
                        req.flash('success', 'Your password has been updated!');
                        res.redirect('/login');
                    });
            } catch (hashError) {
                console.error('Error hashing password:', hashError);
                req.flash('error', 'Error processing new password.');
                res.redirect(`/reset-password/${token}`);
            }
        });
});


// --- Authentication Check Functions ---
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Close database connection when the process exits
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing user database:', err.message);
        } else {
            console.log('User database connection closed.');
        }
        process.exit(0);
    });
});
