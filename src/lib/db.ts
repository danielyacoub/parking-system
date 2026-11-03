import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __hkParkingMongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose.__hkParkingMongoose ?? {
    conn: null,
    promise: null,
  };

globalForMongoose.__hkParkingMongoose = cached;

/**
 * Reuses a single Mongoose connection across hot reloads, route handlers,
 * server actions, scripts, and the custom Socket.io/MQTT server.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example).",
    );
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    mongoose.set("bufferCommands", false);

    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 45_000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  cached.conn = null;
  cached.promise = null;
}

export function getDatabaseStatus(): string {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[mongoose.connection.readyState] ?? "unknown";
}
