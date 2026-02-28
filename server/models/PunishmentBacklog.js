import mongoose from 'mongoose';

const punishmentBacklogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: { type: String, default: 'other' },
    missedCount: { type: Number, default: 1 },
    originalDate: { type: String, required: true },
    sourceSession: { type: String, default: '' },
    assignedToDate: { type: String, default: '' },
    resolved: { type: Number, default: 0 },
}, { timestamps: true });

punishmentBacklogSchema.index({ userId: 1, resolved: 1 });

export default mongoose.models.PunishmentBacklog || mongoose.model('PunishmentBacklog', punishmentBacklogSchema);
