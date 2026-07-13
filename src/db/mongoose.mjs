// src/db/mongoose.mjs
// MongoDB Atlas connection + all data models.
// Add MONGODB_URI to .env:
//   1. Go to mongodb.com/atlas → Create free cluster
//   2. Security → Database Access → Add user with password
//   3. Network Access → Add IP → Allow from anywhere (0.0.0.0/0)
//   4. Clusters → Connect → Drivers → copy the connection string
//   5. Replace <password> with your password
//   6. Paste as MONGODB_URI in .env

import mongoose from "mongoose";
import bcrypt   from "bcryptjs";

// ── Connection ────────────────────────────────────────────────────────────

let _connected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[DB] MONGODB_URI not set — using in-memory store only");
    return false;
  }
  if (_connected) return true;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    _connected = true;
    console.log("[DB] MongoDB Atlas connected ✅");
    return true;
  } catch (err) {
    console.error(`[DB] MongoDB connection failed: ${err.message}`);
    console.warn("[DB] Falling back to in-memory store");
    return false;
  }
}

export function isConnected() {
  return _connected && mongoose.connection.readyState === 1;
}

// ── User Model ────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },   // bcrypt hash
  phone:     { type: String, default: "" },
  country:   { type: String, default: "" },
  createdAt: { type: Date,   default: Date.now },
});

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare plain password against stored hash
userSchema.methods.verifyPassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.models.User || mongoose.model("User", userSchema);

// ── Settlement Model ──────────────────────────────────────────────────────

const settlementSchema = new mongoose.Schema({
  fixtureId:  { type: String, required: true },
  match:      { type: String, required: true },
  stage:      { type: String, default: "" },
  finalScore: { type: String, default: "" },
  winner:     { type: String, default: "" },
  settledAt:  { type: Date,   default: Date.now },
  positions:  { type: Number, default: 0 },
  wins:       { type: Number, default: 0 },
  losses:     { type: Number, default: 0 },
  totalStaked: { type: Number, default: 0 },
  totalPayout: { type: Number, default: 0 },
  totalPnL:    { type: Number, default: 0 },
  records:     { type: Array,  default: [] },
  validation:  { type: Object, default: {} },
});

export const Settlement = mongoose.models.Settlement
  || mongoose.model("Settlement", settlementSchema);

// ── Proof Model ───────────────────────────────────────────────────────────

const proofSchema = new mongoose.Schema({
  fixtureId:       { type: String, required: true },
  match:           { type: String, required: true },
  finalScore:      { type: String, default: "" },
  allVerified:     { type: Boolean, default: false },
  merkleRoot:      { type: String,  default: "" },
  solanaSignature: { type: String,  default: "" },
  solscanUrl:      { type: String,  default: "" },
  timestamp:       { type: Date,    default: Date.now },
});

export const Proof = mongoose.models.Proof
  || mongoose.model("Proof", proofSchema);
