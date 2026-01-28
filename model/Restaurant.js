const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: String,
  image: String,
  isOpen: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Restaurant", restaurantSchema);
