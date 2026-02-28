import mongoose from 'mongoose';

const dailyStatsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    sessionsCompleted: { type: Number, default: 0 },
    sessionsTotal: { type: Number, default: 0 },
    leetcodeCompleted: { type: Number, default: 0 },
    leetcodeTarget: { type: Number, default: 0 },
    punishmentItems: { type: Number, default: 0 },
    waterLiters: { type: Number, default: 0 },
    workoutDone: { type: Number, default: 0 },
}, { timestamps: true });

dailyStatsSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyStats || mongoose.model('DailyStats', dailyStatsSchema);
