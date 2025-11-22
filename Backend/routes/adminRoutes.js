const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust the path to your User model
const authMiddleware = require('../controllers/authMiddleware'); // Optional for security

// Route to fetch all users (excluding passwords)
router.get('/admin/users', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
