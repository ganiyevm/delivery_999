const mongoose = require('mongoose');

const importLogSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    importedBy: { type: String, default: '' },
    totalRows: { type: Number, default: 0 },
    successRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },
    errors: [{
        row: Number,
        message: String,
    }],
    importDate: { type: Date, default: Date.now },
});

importLogSchema.index({ importDate: -1 });

module.exports = mongoose.model('ImportLog', importLogSchema);
