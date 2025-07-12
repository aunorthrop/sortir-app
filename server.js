const express = require('express');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure folders exist
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}
if (!fs.existsSync('data/uploads')) {
  fs.mkdirSync('data/uploads');
}
if (!fs.existsSync('data/sessions')) {
  fs.mkdirSync('data/sessions');
}
if (!fs.existsSync('data/users.json')) {
  fs.writeFileSync('data/users.json', '{}');
}

// Session config
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  store: new session.MemoryStore()
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Add your other routes here (signup, login, file upload, reset-password, etc.)

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
