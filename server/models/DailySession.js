import mongoose from 'mongoose';

const sessionItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, default: 'other' },
    targetCount: { type: Number, default: 1 },
    completedCount: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
}, { _id: true });

const dailySessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    type: { type: String, default: 'normal' },
    category: { type: String, default: 'other' },
    status: { type: String, default: 'pending' },
    icon: { type: String, default: '📚' },
    color: { type: String, default: '#10b981' },
    trackedTime: { type: Number, default: 0 },
    trackingStartedAt: { type: String, default: null },
    items: [sessionItemSchema],
}, { timestamps: true });

dailySessionSchema.index({ userId: 1, date: 1 });

export default mongoose.models.DailySession || mongoose.model('DailySession', dailySessionSchema);
