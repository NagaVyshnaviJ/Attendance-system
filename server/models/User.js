const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'manager'], default: 'employee' }, // [cite: 39]
  employeeId: { type: String, unique: true }, // [cite: 40]
  department: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);