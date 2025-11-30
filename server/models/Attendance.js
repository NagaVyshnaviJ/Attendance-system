const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // [cite: 45]
  date: { type: String, required: true }, // Store as YYYY-MM-DD for easy querying
  checkInTime: { type: Date }, // [cite: 47]
  checkOutTime: { type: Date }, // [cite: 48]
  status: { type: String, enum: ['Present', 'Absent', 'Late', 'Half-day'], default: 'Absent' }, // [cite: 49]
  totalHours: { type: Number, default: 0 } // [cite: 50]
}, { timestamps: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);