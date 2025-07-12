// In server.js

// Forgot Password
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = loadUsers();

  if (!users[email]) {
      // To prevent user enumeration, we send a success message even if the user doesn't exist.
      return res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  }

  const token = uuidv4();
  users[email].resetToken = {
      value: token,
      expires: Date.now() + 3600000 // Token expires in 1 hour
  };
  saveUsers(users);

  const resetLink = `https://sortir-app.onrender.com/reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;

  const mailOptions = {
    from: `"Sortir App" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your Sortir Password Reset Request',
    html: `<p>Hi there,</p><p>We received a request to reset your password. Click the link below to set a new one:</p><p><a href="${resetLink}" style="color: #00e5ff; text-decoration: none;">Reset Your Password</a></p><p>If you did not request this, you can safely ignore this email. This link will expire in 1 hour.</p><p>Thanks,<br/>The Sortir Team</p>`
  };

  // This block has improved error logging
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        // ✅ THIS IS THE IMPORTANT ADDITION FOR DEBUGGING
        console.error('Nodemailer Error:', error); 
        return res.status(500).json({ success: false, message: 'Failed to send email. Please check server logs.' });
    }
    // If successful, we don't log anything sensitive, we just send the response.
    res.status(200).json({ success: true, message: 'If your email is in our system, you will receive a password reset link.' });
  });
});
