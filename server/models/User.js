import mongoose from 'mongoose';

const preferencesSchema = new mongoose.Schema(
  {
    styles: { type: [String], default: [] }, // e.g. ['casual', 'formal', 'sporty']
    favoriteColors: { type: [String], default: [] },
    avoidColors: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Never leak the hash to the client.
userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    preferences: this.preferences,
  };
};

export default mongoose.model('User', userSchema);
