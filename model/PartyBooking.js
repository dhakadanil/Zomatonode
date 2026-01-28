const mongoose = require("mongoose");

const partyBookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  address:String,
  date: String,
  time: String,
  guests: Number,
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PartyBooking", partyBookingSchema);
