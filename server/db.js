import mongoose from 'mongoose';

// Global plugin: ensure all schemas include `id` as a string copy of `_id`
// This makes responses compatible with frontends that expect `.id` instead of `._id`
// Each schema (including subdocument schemas) gets this transform applied independently
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id?.toString?.() || ret._id;
      delete ret._id;
      return ret;
    },
  });
  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id?.toString?.() || ret._id;
      delete ret._id;
      return ret;
    },
  });
});

let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  // Reset if previous connection failed
  if (mongoose.connection.readyState === 0) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI environment variable is not set');

    cached.promise = mongoose.connect(uri, {
      dbName: 'productify',
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    }).then((m) => {
      console.log('✅ Connected to MongoDB Atlas');
      return m;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
