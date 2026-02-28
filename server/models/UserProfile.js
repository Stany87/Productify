import mongoose from 'mongoose';

const userProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    lifeDescription: { type: String, default: '' },
    leetcodeTarget: { type: Number, default: 5 },
    leetcodeUsername: { type: String, default: '' },
    skillFocuses: { type: String, default: '[]' },
    waterTarget: { type: Number, default: 4.0 },
}, { timestamps: true });

export default mongoose.models.UserProfile || mongoose.model('UserProfile', userProfileSchema);
