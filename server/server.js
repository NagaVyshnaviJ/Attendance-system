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
  .then(async () => {
    console.log("MongoDB Connected");
    try {
      await mongoose.connection.collection('users').dropIndex('employeeId_1');
      console.log("✅ Auto-Fix: Old 'employeeId' rule deleted.");
    } catch (err) { /* Index already gone, ignore */ }
  })
  .catch(err => console.log(err));

// --- MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access Denied' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) { res.status(400).json({ error: 'Invalid Token' }); }
};

const verifyManager = (req, res, next) => {
    if (req.user.role !== 'manager') return res.status(403).send("Access Denied");
    next();
};

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, employeeId, department } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ name, email, password: hashedPassword, role, employeeId: employeeId || undefined, department });
    await user.save();
    res.status(201).send("User Registered");
  } catch (err) { res.status(400).send(err.message); }
});

app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send('Email not found');
  const validPass = await bcrypt.compare(req.body.password, user.password);
  if (!validPass) return res.status(400).send('Invalid password');
  const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.header('Authorization', token).json({ token, user });
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
});

// --- ATTENDANCE (EMPLOYEE) ---
app.post('/api/attendance/checkin', verifyToken, async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0];
  const existing = await Attendance.findOne({ userId, date: today });
  if (existing) return res.status(400).send("Already checked in today");
  const now = new Date();
  const status = (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) ? 'Late' : 'Present';
  const attendance = new Attendance({ userId, date: today, checkInTime: now, status });
  await attendance.save();
  res.send(attendance);
});

app.post('/api/attendance/checkout', verifyToken, async (req, res) => {
  const userId = req.user._id;
  const today = new Date().toISOString().split('T')[0];
  const attendance = await Attendance.findOne({ userId, date: today });
  if (!attendance) return res.status(400).send("No check-in record found");
  attendance.checkOutTime = new Date();
  const diffMs = attendance.checkOutTime - attendance.checkInTime;
  attendance.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
  await attendance.save();
  res.send(attendance);
});

app.get('/api/attendance/my-history', verifyToken, async (req, res) => {
    const history = await Attendance.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(history);
});

app.get('/api/attendance/my-summary', verifyToken, async (req, res) => {
    const userId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await Attendance.find({ userId, createdAt: { $gte: startOfMonth } });
    res.json({
        present: records.filter(r => r.status === 'Present').length,
        late: records.filter(r => r.status === 'Late').length,
        absent: records.filter(r => r.status === 'Absent').length,
        totalHours: records.reduce((acc, curr) => acc + (curr.totalHours || 0), 0)
    });
});

app.get('/api/attendance/today', verifyToken, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const record = await Attendance.findOne({ userId: req.user._id, date: today });
    res.json(record || null);
});

// --- MANAGER: REPORTS & FILTERS (NEW) ---

// Helper to build search queries
const buildFilter = (query) => {
    const { startDate, endDate, employeeId } = query;
    let filter = {};
    
    // Add Date Range if provided
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
    }
    
    // Add Specific Employee if provided
    if (employeeId && employeeId !== 'all') {
        filter.userId = employeeId;
    }
    return filter;
};

// Get List of Employees for Dropdown
app.get('/api/users', verifyToken, verifyManager, async (req, res) => {
    const users = await User.find({ role: 'employee' }).select('name _id');
    res.json(users);
});

// Filtered Reports Endpoint
app.get('/api/attendance/reports', verifyToken, verifyManager, async (req, res) => {
    try {
        const filter = buildFilter(req.query);
        const records = await Attendance.find(filter).populate('userId', 'name email employeeId').sort({ date: -1 });
        res.json(records);
    } catch (err) { res.status(500).send(err.message); }
});

// Filtered Export Endpoint
app.get('/api/attendance/export', verifyToken, verifyManager, async (req, res) => {
    try {
        const filter = buildFilter(req.query);
        const records = await Attendance.find(filter).populate('userId', 'name email employeeId');
        
        let csv = 'Employee ID,Name,Email,Date,Status,Check In,Check Out,Total Hours\n';
        records.forEach(r => {
            csv += `${r.userId?.employeeId || 'N/A'},${r.userId?.name},${r.userId?.email},${r.date},${r.status},${r.checkInTime},${r.checkOutTime || 'N/A'},${r.totalHours}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('attendance_report.csv');
        res.send(csv);
    } catch (err) { res.status(500).send(err.message); }
});

// --- DASHBOARD ---
app.get('/api/dashboard/employee', verifyToken, async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await Attendance.find({ userId: req.user._id, createdAt: { $gte: startOfMonth } });
    res.json({
        present: records.filter(r => r.status === 'Present').length,
        late: records.filter(r => r.status === 'Late').length,
        absent: records.filter(r => r.status === 'Absent').length,
        totalHours: records.reduce((acc, curr) => acc + (curr.totalHours || 0), 0).toFixed(1)
    });
});

app.get('/api/dashboard/manager', verifyToken, verifyManager, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const totalEmployees = await User.countDocuments({ role: 'employee' });
    const todayRecords = await Attendance.find({ date: today });
    res.json({
        totalEmployees,
        presentCount: todayRecords.length,
        lateCount: todayRecords.filter(r => r.status === 'Late').length
    });
});

// Basic endpoints required by Dashboard UI
app.get('/api/attendance/today-status', verifyToken, verifyManager, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: today }).populate('userId', 'name email');
    res.json(records);
});
app.get('/api/attendance/all', verifyToken, verifyManager, async (req, res) => {
    const records = await Attendance.find().populate('userId', 'name email').sort({ date: -1 });
    res.json(records);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));