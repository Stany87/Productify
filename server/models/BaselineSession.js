import mongoose from 'mongoose';

const baselineSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    dayOfWeek: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    type: { type: String, default: 'fixed' },
    category: { type: String, default: 'other' },
    icon: { type: String, default: '📚' },
    color: { type: String, default: '#10b981' },
    items: { type: String, default: '[]' },
}, { timestamps: true });

baselineSessionSchema.index({ userId: 1, dayOfWeek: 1 });

export default mongoose.models.BaselineSession || mongoose.model('BaselineSession', baselineSessionSchema);
