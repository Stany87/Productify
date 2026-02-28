import mongoose from 'mongoose';

let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI environment variable is not set');

    cached.promise = mongoose.connect(uri, {
      dbName: 'productify',
    }).then((m) => {
      console.log('✅ Connected to MongoDB Atlas');
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
