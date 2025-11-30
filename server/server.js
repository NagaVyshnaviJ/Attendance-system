const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Attendance = require('./models/Attendance');

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// --- MIDDLEWARE: Verify Token ---
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access Denied' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

// --- ROUTES: AUTH [cite: 53-54] ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, employeeId, department } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt); // [cite: 38]
  
  const user = new User({ name, email, password: hashedPassword, role, employeeId, department });
  try {
    await user.save();
    res.status(201).send("User Registered");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send('Email not found');
  
  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) return res.status(400).send('Invalid password');
  
  const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.header('Authorization', token).json({ token, user });
});

// --- ROUTES: ATTENDANCE (Employee) [cite: 55-57] ---

// Check In
app.post('/api/attendance/checkin', verifyToken, async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const existing = await Attendance.findOne({ userId, date: today });
  if (existing) return res.status(400).send("Already checked in today");

  // Logic for "Late" status (e.g., after 9:30 AM)
  const now = new Date();
  let status = 'Present';
  if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) {
    status = 'Late';
  }

  const attendance = new Attendance({
    userId,
    date: today,
    checkInTime: now,
    status: status
  });

  await attendance.save();
  res.send(attendance);
});

// Check Out
app.post('/api/attendance/checkout', verifyToken, async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0];

  const attendance = await Attendance.findOne({ userId, date: today });
  if (!attendance) return res.status(400).send("You have not checked in yet");

  attendance.checkOutTime = new Date();
  
  // Calculate Total Hours [cite: 50]
  const diffMs = attendance.checkOutTime - attendance.checkInTime;
  const hours = diffMs / (1000 * 60 * 60);
  attendance.totalHours = hours.toFixed(2);

  await attendance.save();
  res.send(attendance);
});

// --- ROUTES: DASHBOARD (Manager) [cite: 61-62] ---
app.get('/api/attendance/all', verifyToken, async (req, res) => {
    // Only managers should access this
    if(req.user.role !== 'manager') return res.status(403).send("Access Denied");
    
    // Populate user details to show names
    const records = await Attendance.find().populate('userId', 'name email employeeId');
    res.json(records);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));