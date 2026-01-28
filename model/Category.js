const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
    image: { type: String },
  name: { type: String, required: true },
});

module.exports = mongoose.model("Category", categorySchema);
