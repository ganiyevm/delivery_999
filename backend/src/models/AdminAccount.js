const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    username:     { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName:     { type: String, default: '' },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'operator', 'pharmacist', 'analyst'],
        default: 'operator',
    },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: String, default: 'system' },
    lastLoginAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('AdminAccount', schema);
