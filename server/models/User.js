import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, default: 'User', trim: true },
    passwordHash: { type: String, required: true },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
