const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: String,
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    description: {
  type: String,
},

  ratings: [
    {
      userId: String,
      value: { type: Number, min: 1, max: 5 }
    }
  ],
  avgRating: { type: Number, default: 0 }




  },
  
  { timestamps: true }

  
);

module.exports = mongoose.model("Product", ProductSchema);
