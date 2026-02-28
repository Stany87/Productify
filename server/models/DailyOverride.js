import mongoose from 'mongoose';

const dailyOverrideSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    reason: { type: String, default: '' },
}, { timestamps: true });

dailyOverrideSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyOverride || mongoose.model('DailyOverride', dailyOverrideSchema);
