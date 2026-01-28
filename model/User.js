const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // initially optional
  passwordTemp: { type: String },              // temp password before OTP verification
 mobile:{type:Number},
  otp: { type: String },
  otpExpire: { type: Date },
  isVerified: { type: Boolean, default: false },
});

module.exports = mongoose.model("User", userSchema);
