const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const {
  JWT_SECRET,
  RESET_TOKEN_TTL_MINUTES,
  EMAIL_FROM,
} = require("../config/env");
const { transporter, isMailerReady } = require("../config/mailer");
const { normalizeEmail, isValidEmail } = require("../utils/validators");
const {
  MIN_PASSWORD_LENGTH,
  buildResetUrl,
  hashToken,
} = require("../utils/auth");

const register = async (req, res) => {
  try {
    const { email, password, fullName, avatar } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = (fullName || "").trim();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (!trimmedName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      fullName: trimmedName,
      avatar,
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        notificationChannels: user.notificationChannels,
      },
    });
  } catch (e) {
    if (e.code === 11000)
      return res.status(400).json({ message: "User already exists" });
    console.error("Register error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    // 1. Lấy dữ liệu từ body
    const { email, password } = req.body || {};

    // 2. KIỂM TRA THIẾU TRƯỜNG (Sửa lỗi UT-LI-04, 05, 06)
    // Test yêu cầu trả về 400 và message "Missing required fields"
    if (!email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 3. KIỂM TRA ĐỊNH DẠNG EMAIL (Sửa lỗi UT-LI-07)
    // Test yêu cầu trả về 400 và message "Invalid email"
    const normalizedEmail = normalizeEmail(email); // Hàm này thường trim() và toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // 4. TÌM USER (Sửa lỗi UT-LI-08)
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Test yêu cầu trả về 401 (Unauthorized) cho lỗi đăng nhập
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 5. KIỂM TRA PASSWORD (Sửa lỗi UT-LI-09)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Test yêu cầu trả về 401
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 6. TẠO TOKEN VÀ TRẢ VỀ THÀNH CÔNG (UT-LI-01)
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        notificationChannels: user.notificationChannels,
      },
    });
  } catch (e) {
    // 7. LỖI HỆ THỐNG (UT-LI-10, 11)
    console.error("Login error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
const forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const genericMessage =
    "If the email exists, you will receive a reset link shortly.";

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.json({ message: genericMessage });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.json({ message: genericMessage });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );
    user.resetRequestedAt = new Date();
    user.resetUsedAt = null;
    await user.save();

    const resetUrl = buildResetUrl(token);

    if (isMailerReady() && transporter) {
      const mailOptions = {
        from: EMAIL_FROM,
        to: user.email,
        subject: "[UniFlow] Reset your password",
        html: `
          <div style="font-family: 'Segoe UI', Roboto, sans-serif; background:#f8fafc; padding:20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; box-shadow:0 8px 30px rgba(15,23,42,0.08); overflow:hidden;">
              <tr>
                <td style="background:#2563eb; color:#fff; padding:18px 24px; font-weight:700; font-size:18px;">
                  UniFlow Password Reset
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 12px; font-size:15px; color:#0f172a;">Hello ${user.fullName || user.email},</p>
                  <p style="margin:0 0 16px; font-size:14px; color:#334155;">Click the button below to reset your password. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
                  <a href="${resetUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:600; font-size:14px;">Reset password</a>
                  <p style="margin:16px 0 0; font-size:12px; color:#64748b; word-break:break-all;">If the button does not work, open this link: ${resetUrl}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px; background:#f1f5f9; font-size:12px; color:#64748b;">
                  If you did not request this, please ignore this email.
                </td>
              </tr>
            </table>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (err) {
        console.error("Send reset email failed:", err.message);
      }
    } else {
      console.warn(
        "Password reset requested but email not configured. Reset URL:",
        resetUrl,
      );
    }

    res.json({ message: genericMessage });
  } catch (e) {
    console.error("Forgot password error:", e.message);
    res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== "string") {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!user)
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    user.resetRequestedAt = null;
    user.resetUsedAt = new Date();
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (e) {
    console.error("Reset password error:", e.message);
    res.status(500).json({ message: "Server error" });
  }
};

const me = async (req, res) => {
  const user = req.user;
  res.json({
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    avatar: user.avatar,
    notificationChannels: user.notificationChannels,
  });
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
};
