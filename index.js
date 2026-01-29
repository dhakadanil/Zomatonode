require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const User = require("./model/User");
const Category = require('./model/Category');
const Product = require('./model/Product');
const Order = require('./model/Order');
const Banner = require('./model/Banner');
const PartyBooking = require('./model/PartyBooking');
const app = express();

app.use(express.json());
app.use(cors());
app.use("/image", express.static("./public/image")); // serve images


// Multer config for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/image");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });


// ===== MongoDB Connect =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// ===== Nodemailer Transporter =====
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});



// =========================
// SEND OTP FOR REGISTRATION
// =========================
app.post("/send-otp", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & Password required" });

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email }); // password optional, OTP based
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpire = Date.now() + 5 * 60 * 1000; // 5 min
    user.passwordTemp = await bcrypt.hash(password, 10);

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Your OTP Verification Code",
      html: `<h2>Hello!</h2><p>Your OTP is: <b>${otp}</b></p>`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});


// =========================
// VERIFY OTP & REGISTER
// =========================
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });
    if (user.otpExpire < Date.now()) return res.status(400).json({ error: "OTP Expired" });

    user.password = user.passwordTemp;
    user.passwordTemp = null;
    user.otp = null;
    user.otpExpire = null;
    user.isVerified = true;

    await user.save();
    res.json({ message: "Registration Successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});


// =========================
// LOGIN
// =========================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email & Password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });
    if (!user.isVerified)
      return res.status(400).json({ message: "Please verify your email first" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Wrong password" });

    // 🔐 JWT TOKEN
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({
      message: "Login Successful",
      token,
      email: user.email,
      user: {
        _id: user._id,
        name: user.name, // optional
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// =========================
// FORGOT PASSWORD - SEND OTP
// =========================
// =========================
// FORGOT PASSWORD - SEND OTP
// =========================
app.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email not registered" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpExpire = Date.now() + 5 * 60 * 1000; // 5 min expiry
    await user.save();

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Your OTP for Password Reset",
      html: `<h3>Hello!</h3><p>Your OTP is: <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// VERIFY OTP AND RESET PASSWORD
// =========================
app.post("/forgot-password/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email not registered" });

    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpire < Date.now()) return res.status(400).json({ message: "OTP expired" });

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear OTP
    user.otp = null;
    user.otpExpire = null;

    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// =========================
// CATEGORY ROUTES
// =========================

// Add Category
app.post("/api/category/add", upload.single("image"), async (req, res) => {
  try {
    const { name, restaurantId } = req.body;
    if (!name || !restaurantId) return res.status(400).json({ error: "Name & restaurantId required" });
    
    const image = req.file ? req.file.filename : null;
    const category = new Category({ name, restaurantId, image });
    await category.save();
    res.json(category);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Categories by Restaurant
app.get("/api/category/:restaurantId", async (req, res) => {
  try {
    const categories = await Category.find({ restaurantId: req.params.restaurantId });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Category
app.put("/api/category/:id", upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = { name };
    if (req.file) updateData.image = req.file.filename;
    const updated = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Category
app.delete("/api/category/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =========================
// PRODUCT ROUTES
// =========================

// Add Product
app.post("/api/product/add", upload.single("image"), async (req, res) => {
  try {
    const { name, price,description, categoryId } = req.body;

    if (!name || !price || !description || !categoryId) {
      return res.status(400).json({ error: "All fields required" });
    }

    const product = new Product({
      name,
      price,
      description,
      categoryId,
      image: req.file ? req.file.filename : null,
    });

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rate Product
app.post("/api/product/rate/:id", async (req, res) => {
  try {
    const { userId, value } = req.body;

    const product = await Product.findById(req.params.id);

    // remove old rating from same user
    product.ratings = product.ratings.filter(
      (r) => r.userId !== userId
    );

    // add new rating
    product.ratings.push({ userId, value });

    // calculate avg
    const avg =
      product.ratings.reduce((a, b) => a + b.value, 0) /
      product.ratings.length;

    product.avgRating = avg.toFixed(1);

    await product.save();
    res.json({ success: true, avgRating: product.avgRating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Products
app.get("/api/product", async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId", "name");
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products by Selected Category
app.get("/api/categoryproduct/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Get all products with populated category name
    const allProducts = await Product.find().populate("categoryId", "name");

    // Order products: selected category first
    const orderedProducts = [
      ...allProducts.filter((p) => p.categoryId?._id.toString() === categoryId),
      ...allProducts.filter((p) => p.categoryId?._id.toString() !== categoryId),
    ];

    res.json(orderedProducts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Product
app.get("/api/product/single/:id", async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("categoryId", "name");
  res.json(product);
});

// Update Product
app.put("/api/product/:id", upload.single("image"), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      price: req.body.price,
      description:req.body.description,
      categoryId: req.body.categoryId,
    };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Product
app.delete("/api/product/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products by Category (User Interface)
app.get("/api/product/by-category/:categoryId", async (req, res) => {
  try {
    const products = await Product.find({
      categoryId: req.params.categoryId,
    }).populate("categoryId", "name");

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =========================
// ORDER ROUTES
// =========================

// Create Order (Admin)
app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items, total } = req.body;
    const order = new Order({
      customer: {
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        address: customer.address,
      },
      items: items.map((item) => ({
        productId: item._id,
        qty: item.qty,
      })),
      total,
    });

    await order.save();
    res.status(201).json({ message: "Order created", order });
} catch (err) {
  console.error("ORDER ERROR 👉", err.message);
  res.status(500).json({
    message: "Something went wrong",
    error: err.message,
  });
}
});

// Get All Orders (Admin)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.productId", "name price"); // 👈 product data UI के लिए

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// User Place Order + Send Email
app.post("/myorder", async (req, res) => {
  try {
    const { customer, items, total } = req.body;

    // ✅ MOBILE MUST
    if (!customer?.mobile || !items || items.length === 0) {
      return res.status(400).json({ error: "Mobile & items required" });
    }

    const formattedItems = items.map(item => ({
      productId: item._id,
      qty: item.qty
    }));

    const order = new Order({
      customer: {
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,   // ✅ SAME MOBILE
        address: customer.address
      },
      items: formattedItems,
      total
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Order placed",
      data: order
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Check Orders by Mobile Number
app.get("/myorder/:mobile", async (req, res) => {
  try {
    const { mobile } = req.params;

    const orders = await Order.find({
      "customer.mobile": mobile
    })
      .populate("items.productId", "name price image")
      .sort({ createdAt: -1 });

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel Order by ID
app.delete("/order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Order.findByIdAndDelete(id); // ya status update: { status: "Cancelled" }
    res.json({ success: true, message: "Order cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// =========================
// BANNER ROUTES
// =========================

// Add Banner
app.post("/api/banner/add", upload.single("image"), async (req, res) => {
  try {
    const banner = new Banner({
      title: req.body.title,
      subtitle: req.body.subtitle,
      discount: req.body.discount,
      image: req.file.filename,
      active: req.body.active,
    });
    await banner.save();
    res.json({ message: "Banner Added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Banners (Admin)
app.get("/api/banner", async (req, res) => {
  try {
    const banners = await Banner.find();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Active Banners (Frontend)
app.get("/api/banner/active", async (req, res) => {
  try {
    const banners = await Banner.find({ active: true });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Banner
app.delete("/api/banner/:id", async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Banner
app.put("/api/banner/:id", upload.single("image"), async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      discount: req.body.discount,
      active: req.body.active,
    };
    if (req.file) updateData.image = req.file.filename;

    const updated = await Banner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =========================
// PARTY BOOKING ROUTES
// =========================

// Save Booking (User)
app.post("/api/party/book-party", async (req, res) => {
  try {
    const booking = new PartyBooking(req.body);
    await booking.save();
    res.json({ success: true, message: "🎉 Party booked successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get All Bookings (Admin)
app.get("/api/party/all-bookings", async (req, res) => {
  try {
    const data = await PartyBooking.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// =========================
// START SERVER
// =========================
app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
