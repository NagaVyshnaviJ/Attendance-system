const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'manager'], default: 'employee' },
  
  // FIX: Add "sparse: true" so multiple users can have null/empty IDs
  employeeId: { type: String, unique: true, sparse: true }, 
  
  department: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);