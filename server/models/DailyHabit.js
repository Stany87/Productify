import mongoose from 'mongoose';

const dailyHabitSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    habitType: { type: String, required: true },
    targetValue: { type: Number, default: 1 },
    currentValue: { type: Number, default: 0 },
}, { timestamps: true });

dailyHabitSchema.index({ userId: 1, date: 1, habitType: 1 }, { unique: true });

export default mongoose.models.DailyHabit || mongoose.model('DailyHabit', dailyHabitSchema);
