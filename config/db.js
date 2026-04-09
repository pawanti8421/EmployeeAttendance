// config/db.js
// Connects to MongoDB Atlas using Mongoose.
// Call connectDB() once at server startup.

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI is not set in your .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅  Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Log connection events
mongoose.connection.on('disconnected', () =>
  console.warn('⚠️   MongoDB disconnected — will auto-reconnect')
);
mongoose.connection.on('reconnected', () =>
  console.log('✅  MongoDB reconnected')
);

module.exports = connectDB;
