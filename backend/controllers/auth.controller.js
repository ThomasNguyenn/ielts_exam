import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Valid giftcodes for teacher registration
const VALID_GIFTCODES = {
  "TEACHER2026": "teacher",
  "ADMINSCOTS": "admin",
};

export const register = async (req, res) => {
  try {
    const { email, password, name, role, giftcode } = req.body;
    const normalizedGiftcode = giftcode?.trim().toUpperCase();

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: "Email, password, and name are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // If registering as teacher or admin, validate giftcode
    if (role === 'teacher' || role === 'admin') {
      if (!normalizedGiftcode) {
        return res.status(400).json({ success: false, message: `Giftcode is required for ${role} registration` });
      }

      const validRole = VALID_GIFTCODES[normalizedGiftcode];
      if (!validRole || validRole !== role) {
        return res.status(400).json({ success: false, message: "Invalid giftcode for this role" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Determine final role (giftcode may grant higher access)
    let finalRole = role || 'student';
    if (normalizedGiftcode && VALID_GIFTCODES[normalizedGiftcode]) {
      finalRole = VALID_GIFTCODES[normalizedGiftcode];
    }

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: finalRole,
      giftcode: normalizedGiftcode || null,
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targets, name } = req.body;

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (targets) {
      // Ensure targets are preserved if partial update, but we can just set the object for now or merge deep if needed
      // Assuming frontend sends full targets object or we use dot notation for partials if using mongoose directly
      // Here we replace the targets object or specific fields if provided
      updateFields.targets = targets;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: user,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Admin endpoint to verify giftcode (returns 200 with valid status)
export const verifyGiftcode = async (req, res) => {
  const { giftcode, role } = req.body;
  const normalizedGiftcode = giftcode?.trim().toUpperCase();

  if (!normalizedGiftcode || !role) {
    return res.status(200).json({ success: true, valid: false, message: "Giftcode and role are required" });
  }

  const validRole = VALID_GIFTCODES[normalizedGiftcode];
  if (validRole && validRole === role) {
    res.status(200).json({ success: true, valid: true, message: "Valid giftcode" });
  } else {
    res.status(200).json({ success: true, valid: false, message: "Invalid giftcode" });
  }
};
