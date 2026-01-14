
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// --- CONFIGURATION ---
const PORT = process.env.PORT || 5050;
// Sử dụng URI bạn đã cung cấp
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nhutrunghai:30122005@twitter-free-cluster.d9hq5kr.mongodb.net/UniFlow_DB?retryWrites=true&w=majority&appName=Twitter-Free-Cluster';
const JWT_SECRET = process.env.JWT_SECRET || 'nhutrunghai';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'uniflow@localhost';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES) || 30;

// --- CONFIGURATION HELPERS ---
const normalizeEmail = (email = '') => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const MIN_PASSWORD_LENGTH = 8;
const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');
const buildResetUrl = (token) => `${trimTrailingSlash(APP_BASE_URL)}/reset?token=${encodeURIComponent(token)}`;
const hashToken = (token = '') => crypto.createHash('sha256').update(token).digest('hex');
const toMinutes = (timeStr = '') => {
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
const computeReminderAt = (dueDate, minutesBefore) => {
  if (!dueDate && minutesBefore !== 0) return null;
  const due = new Date(dueDate);
  const mins = Number(minutesBefore);
  if (Number.isNaN(mins) || mins < 0 || Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() - mins * 60 * 1000);
};
const hasEmailChannel = (user) => {
  if (!user || !Array.isArray(user.notificationChannels)) return true;
  return user.notificationChannels.includes('EMAIL');
};

const upsertNotification = async ({ userId, targetId, targetType = 'TASK', channel = 'EMAIL', sendAt, title, remindBefore, dueDate }) => {
  if (!sendAt || !userId || !targetId) return;
  await Notification.findOneAndUpdate(
    { userId, targetId, channel },
    { userId, targetId, targetType, channel, sendAt, title, remindBefore, dueDate, status: 'PENDING', error: null },
    { upsert: true, new: true }
  );
};

const cancelNotification = async ({ userId, targetId, channel = 'EMAIL' }) => {
  await Notification.deleteMany({ userId, targetId, channel });
};

// --- EMAIL TRANSPORT ---
let mailerReady = false;
let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  transporter.verify().then(() => {
    mailerReady = true;
    console.log('Email transporter ready');
  }).catch(err => {
    console.error('Email transporter error:', err.message);
  });
} else {
  console.warn('Email transport not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to enable reminders.');
}

// --- DATABASE CONNECTION ---
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ UniFlow DB Connected Successfully'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  major: { type: String, required: true, trim: true },
  avatar: String,
  notificationChannels: { type: [String], enum: ['EMAIL', 'PUSH'], default: ['EMAIL'] },
  resetTokenHash: String,
  resetTokenExpiresAt: Date,
  resetRequestedAt: Date,
  resetUsedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  code: String,
  instructor: String,
  room: String,
  link: String,
  type: { type: String, enum: ['REGULAR', 'ONLINE', 'EXAM'], default: 'REGULAR' },
  dayOfWeek: Number,
  startTime: String,
  endTime: String,
  startDate: { type: String, required: true },
  color: String,
  notes: String,
  reminderMinutes: Number
}, { timestamps: true });

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'], default: 'TODO' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  reminderEnabled: { type: Boolean, default: false },
  reminderMinutesBefore: Number,
  reminderAt: Date,
  reminderSent: { type: Boolean, default: false }
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['TASK', 'EVENT', 'NOTE'], default: 'TASK' },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  channel: { type: String, enum: ['EMAIL', 'PUSH'], default: 'EMAIL' },
  sendAt: { type: Date, required: true },
  status: { type: String, enum: ['PENDING', 'SENT', 'FAILED', 'CANCELED'], default: 'PENDING' },
  error: String,
  title: String,
  remindBefore: Number,
  dueDate: Date
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  content: String,
  reminderEnabled: { type: Boolean, default: false },
  reminderAt: Date,
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Event = mongoose.model('Event', EventSchema);
const Task = mongoose.model('Task', TaskSchema);
const Note = mongoose.model('Note', NoteSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- MIDDLEWARE: AUTH ---
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// --- API ROUTES ---

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, major, avatar } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = (fullName || '').trim();
    const trimmedMajor = (major || '').trim();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email' });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!trimmedName || !trimmedMajor) {
      return res.status(400).json({ message: 'Full name and major are required' });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ email: normalizedEmail, password: hashedPassword, fullName: trimmedName, major: trimmedMajor, avatar });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar, notificationChannels: user.notificationChannels } });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'User already exists' });
    console.error('Register error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail) || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar, notificationChannels: user.notificationChannels } });
  } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const genericMessage = 'If the email exists, you will receive a reset link shortly.';

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.json({ message: genericMessage });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.json({ message: genericMessage });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    user.resetRequestedAt = new Date();
    user.resetUsedAt = null;
    await user.save();

    const resetUrl = buildResetUrl(token);

    if (mailerReady && transporter) {
      const mailOptions = {
        from: EMAIL_FROM,
        to: user.email,
        subject: '[UniFlow] Reset your password',
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
        console.error('Send reset email failed:', err.message);
      }
    } else {
      console.warn('Password reset requested but email not configured. Reset URL:', resetUrl);
    }

    res.json({ message: genericMessage });
  } catch (e) {
    console.error('Forgot password error:', e.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    user.resetRequestedAt = null;
    user.resetUsedAt = new Date();
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (e) {
    console.error('Reset password error:', e.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = req.user;
  res.json({ id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar, notificationChannels: user.notificationChannels });
});

app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (Array.isArray(payload.notificationChannels)) {
      payload.notificationChannels = payload.notificationChannels.filter(c => ['EMAIL', 'PUSH'].includes(c));
    } else {
      delete payload.notificationChannels;
    }

    const prevChannels = Array.isArray(req.user.notificationChannels) ? req.user.notificationChannels : ['EMAIL'];
    const user = await User.findByIdAndUpdate(req.userId, payload, { new: true });

    if (Array.isArray(payload.notificationChannels)) {
      const nextChannels = Array.isArray(user.notificationChannels) ? user.notificationChannels : [];
      const hadEmail = prevChannels.includes('EMAIL');
      const hasEmail = nextChannels.includes('EMAIL');

      if (!hasEmail) {
        await Notification.updateMany(
          { userId: req.userId, channel: 'EMAIL', status: 'PENDING' },
          { status: 'CANCELED', error: 'Email notifications disabled' }
        );
      } else if (!hadEmail && hasEmail) {
        const tasksToNotify = await Task.find({
          userId: req.userId,
          reminderEnabled: true,
          reminderSent: { $ne: true }
        });
        const now = new Date();
        for (const task of tasksToNotify) {
          const sendAt = task.reminderAt || computeReminderAt(task.dueDate, task.reminderMinutesBefore);
          if (!sendAt) continue;
          const sendDate = new Date(sendAt);
          if (Number.isNaN(sendDate.getTime()) || sendDate <= now) continue;
          await upsertNotification({
            userId: req.userId,
            targetId: task._id,
            targetType: 'TASK',
            channel: 'EMAIL',
            sendAt: sendDate,
            title: task.title,
            remindBefore: task.reminderMinutesBefore,
            dueDate: task.dueDate
          });
        }
        const notesToNotify = await Note.find({
          userId: req.userId,
          reminderEnabled: true,
          reminderAt: { $gt: now }
        });
        for (const note of notesToNotify) {
          const sendAt = note.reminderAt;
          if (!sendAt) continue;
          const noteTitle = (note.content || '').trim().slice(0, 80) || 'Note reminder';
          await upsertNotification({
            userId: req.userId,
            targetId: note._id,
            targetType: 'NOTE',
            channel: 'EMAIL',
            sendAt: sendAt,
            title: noteTitle,
            remindBefore: 0,
            dueDate: sendAt
          });
        }
      }
    }

    res.json({ id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar, notificationChannels: user.notificationChannels });
  } catch (e) { res.status(500).json({ message: 'Error updating profile' }); }
});

// Events
app.get('/api/events', auth, async (req, res) => {
  const events = await Event.find({ userId: req.userId });
  res.json(events);
});

app.post('/api/events', auth, async (req, res) => {
  try {
    const { title, dayOfWeek, startTime, endTime, startDate } = req.body || {};
    if (!title || !startDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const computedDay = new Date(startDate).getDay();

    const startM = toMinutes(startTime);
    const endM = toMinutes(endTime);
    if (startM === null || endM === null || startM >= endM) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    const sameDayEvents = await Event.find({ userId: req.userId, dayOfWeek: computedDay });
    const overlaps = sameDayEvents.some(ev => {
      const evStart = toMinutes(ev.startTime);
      const evEnd = toMinutes(ev.endTime);
      if (evStart === null || evEnd === null) return false;
      return startM < evEnd && endM > evStart;
    });
    if (overlaps) return res.status(409).json({ message: 'Time slot already booked' });

    const event = new Event({ ...req.body, userId: req.userId, dayOfWeek: computedDay });
    await event.save();
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ message: 'Error creating event' }); }
});

// Update event
app.put('/api/events/:id', auth, async (req, res) => {
  try {
    const { title, dayOfWeek, startTime, endTime, startDate, swapWith } = req.body || {};
    if (!title || !startDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const computedDay = new Date(startDate).getDay();

    const startM = toMinutes(startTime);
    const endM = toMinutes(endTime);
    if (startM === null || endM === null || startM >= endM) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    const excludeIds = [req.params.id];
    if (swapWith) excludeIds.push(swapWith);

    const sameDayEvents = await Event.find({ userId: req.userId, dayOfWeek: computedDay, _id: { $nin: excludeIds } });
    const overlaps = sameDayEvents.some(ev => {
      const evStart = toMinutes(ev.startTime);
      const evEnd = toMinutes(ev.endTime);
      if (evStart === null || evEnd === null) return false;
      return startM < evEnd && endM > evStart;
    });
    if (overlaps) return res.status(409).json({ message: 'Time slot already booked' });

    const updated = await Event.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { ...req.body, dayOfWeek: computedDay },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Event not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: 'Error updating event' }); }
});

app.delete('/api/events/:id', auth, async (req, res) => {
  try {
    await Event.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Event deleted' });
  } catch (e) { res.status(500).json({ message: 'Error deleting event' }); }
});

// Tasks
app.get('/api/tasks', auth, async (req, res) => {
  const tasks = await Task.find({ userId: req.userId });
  res.json(tasks);
});

app.post('/api/tasks', auth, async (req, res) => {
  try {
  const reminderEnabled = !!req.body.reminderEnabled;
  const parsedMinutes = reminderEnabled ? Number(req.body.reminderMinutesBefore) : undefined;
  const reminderMinutesBefore = reminderEnabled ? (Number.isNaN(parsedMinutes) ? undefined : parsedMinutes) : undefined;
  const reminderAt = reminderEnabled ? computeReminderAt(req.body.dueDate, reminderMinutesBefore) : undefined;
  const allowEmail = hasEmailChannel(req.user);
  const task = new Task({ 
    ...req.body, 
    reminderEnabled,
    reminderMinutesBefore,
    reminderAt,
    reminderSent: reminderEnabled ? false : undefined,
    userId: req.userId 
  });
  await task.save();
  if (reminderEnabled && reminderAt && allowEmail) {
    await upsertNotification({
      userId: req.userId,
      targetId: task._id,
      targetType: 'TASK',
      channel: 'EMAIL',
      sendAt: reminderAt,
      title: task.title,
      remindBefore: reminderMinutesBefore,
      dueDate: task.dueDate
    });
  } else {
    await cancelNotification({ userId: req.userId, targetId: task._id, channel: 'EMAIL' });
  }
    res.json(task);
  } catch (e) { res.status(500).json({ message: 'Error creating task' }); }
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  try {
    const existing = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    const reminderEnabled = !!req.body.reminderEnabled;
    const parsedMinutes = reminderEnabled ? Number(req.body.reminderMinutesBefore) : undefined;
    const reminderMinutesBefore = reminderEnabled ? (Number.isNaN(parsedMinutes) ? undefined : parsedMinutes) : undefined;
    const effectiveDueDate = req.body.dueDate || existing.dueDate;
    const reminderAt = reminderEnabled ? computeReminderAt(effectiveDueDate, reminderMinutesBefore) : undefined;
    const allowEmail = hasEmailChannel(req.user);

    const reminderSent = reminderEnabled
      ? false
      : (req.body.reminderSent === false ? false : existing.reminderSent);
    const updatePayload = {
      ...req.body,
      reminderEnabled,
      reminderMinutesBefore,
      reminderAt,
      reminderSent
    };

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updatePayload,
      { new: true }
    );

    if (reminderEnabled && reminderAt && allowEmail) {
      await upsertNotification({
        userId: req.userId,
        targetId: task._id,
        targetType: 'TASK',
        channel: 'EMAIL',
        sendAt: reminderAt,
        title: task.title,
        remindBefore: reminderMinutesBefore,
        dueDate: task.dueDate || effectiveDueDate
      });
    } else {
      await cancelNotification({ userId: req.userId, targetId: task._id, channel: 'EMAIL' });
    }

    res.json(task);
  } catch (e) { res.status(500).json({ message: 'Error updating task' }); }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    await cancelNotification({ userId: req.userId, targetId: req.params.id, channel: 'EMAIL' });
    res.json({ message: 'Task deleted' });
  } catch (e) { res.status(500).json({ message: 'Error deleting task' }); }
});

// Notes
app.get('/api/notes', auth, async (req, res) => {
  const notes = await Note.find({ userId: req.userId });
  res.json(notes);
});

app.post('/api/notes', auth, async (req, res) => {
  try {
    const { eventId, content, reminderEnabled, reminderAt } = req.body;
    const enableReminder = !!reminderEnabled;
    let reminderAtDate = null;
    if (enableReminder && reminderAt) {
      reminderAtDate = new Date(reminderAt);
      if (Number.isNaN(reminderAtDate.getTime())) {
        return res.status(400).json({ message: 'Invalid reminder time' });
      }
      if (reminderAtDate.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Reminder time cannot be in the past' });
      }
    }
    const note = await Note.findOneAndUpdate(
      { userId: req.userId, eventId },
      { content, reminderEnabled: enableReminder, reminderAt: enableReminder ? reminderAtDate : null, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    const allowEmail = hasEmailChannel(req.user);
    if (enableReminder && reminderAtDate && allowEmail) {
      let noteTitle = 'Note reminder';
      if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
        const event = await Event.findOne({ _id: eventId, userId: req.userId }).select('title');
        if (event?.title) noteTitle = `Note: ${event.title}`;
      }
      const trimmedContent = (content || '').trim();
      if (trimmedContent) {
        noteTitle = `${noteTitle} - ${trimmedContent.slice(0, 80)}`;
      }
      await upsertNotification({
        userId: req.userId,
        targetId: note._id,
        targetType: 'NOTE',
        channel: 'EMAIL',
        sendAt: reminderAtDate,
        title: noteTitle,
        remindBefore: 0,
        dueDate: reminderAtDate
      });
    } else {
      await cancelNotification({ userId: req.userId, targetId: note._id, channel: 'EMAIL' });
    }
    res.json(note);
  } catch (e) { res.status(500).json({ message: 'Error saving note' }); }
});

app.delete('/api/notes/:id', auth, async (req, res) => {
  try {
    const deleted = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Note not found' });
    await cancelNotification({ userId: req.userId, targetId: req.params.id, channel: 'EMAIL' });
    res.json({ message: 'Note deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Error deleting note' });
  }
});

// Notifications
app.get('/api/notifications', auth, async (req, res) => {
  const notifications = await Notification.find({ userId: req.userId }).sort({ sendAt: 1 });
  res.json(notifications);
});

app.put('/api/notifications/:id', auth, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.sendAt) payload.sendAt = new Date(payload.sendAt);
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      payload,
      { new: true }
    );
    res.json(notif);
  } catch (e) { res.status(500).json({ message: 'Error updating notification' }); }
});

// --- REMINDER SCHEDULER (EMAIL) ---
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;
const formatDateTime = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { hour12: false });
};

const processDueReminders = async () => {
  if (!mailerReady || !transporter) return;
  const now = new Date();
  try {
    const dueNotifications = await Notification.find({
      status: 'PENDING',
      sendAt: { $lte: now },
      channel: 'EMAIL'
    }).limit(50).populate('userId', 'email fullName notificationChannels');

    for (const notif of dueNotifications) {
      const user = notif.userId;
      if (!user || !user.email) {
        await Notification.updateOne({ _id: notif._id }, { status: 'CANCELED' });
        continue;
      }
      if (!hasEmailChannel(user)) {
        await Notification.updateOne({ _id: notif._id }, { status: 'CANCELED', error: 'Email notifications disabled' });
        continue;
      }

      const mailOptions = {
        from: EMAIL_FROM,
        to: user.email,
        subject: `[UniFlow] Nhắc nhở: ${notif.title || 'Nhiệm vụ'}`,
        html: `
          <div style="font-family: 'Segoe UI', Roboto, sans-serif; background:#f8fafc; padding:20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; box-shadow:0 8px 30px rgba(15,23,42,0.08); overflow:hidden;">
              <tr>
                <td style="background:#2563eb; color:#fff; padding:18px 24px; font-weight:700; font-size:18px;">
                  UniFlow · Nhắc nhở
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 12px; font-size:15px; color:#0f172a;">Chào ${user.fullName || user.email},</p>
                  <p style="margin:0 0 16px; font-size:14px; color:#334155;">Bạn có nhắc nhở sắp đến hạn. Chi tiết:</p>
                  <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#f8fafc; margin-bottom:16px;">
                    <div style="font-size:14px; color:#1e293b; margin-bottom:10px;"><strong>Tiêu đề:</strong> ${notif.title || 'Nhiệm vụ'}</div>
                    <div style="font-size:14px; color:#1e293b; margin-bottom:10px;"><strong>Thời điểm nhắc:</strong> ${formatDateTime(notif.sendAt)}</div>
                    <div style="font-size:14px; color:#1e293b;"><strong>Nhắc trước:</strong> ${notif.remindBefore || 0} phút</div>
                  </div>
                  <a href="#" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:600; font-size:14px;">Mở UniFlow</a>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px; background:#f1f5f9; font-size:12px; color:#64748b;">
                  Đây là email tự động, vui lòng không trả lời. Nếu bạn không muốn nhận, hãy tắt nhắc nhở trong nhiệm vụ tương ứng.
                </td>
              </tr>
            </table>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        await Notification.updateOne({ _id: notif._id }, { status: 'SENT', error: null });
        // Đánh dấu task đã nhắc để UI chuyển sang "Đã nhắc"
        if (notif.targetType === 'TASK') {
          await Task.updateOne({ _id: notif.targetId, userId: notif.userId }, { reminderSent: true, reminderEnabled: false, reminderAt: undefined });
        }
      } catch (err) {
        console.error('Send reminder email failed:', err.message);
        await Notification.updateOne({ _id: notif._id }, { status: 'FAILED', error: err.message });
      }
    }
  } catch (e) {
    console.error('Reminder scheduler error:', e.message);
  }
};

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  setInterval(processDueReminders, REMINDER_CHECK_INTERVAL_MS);
  setTimeout(processDueReminders, 10 * 1000);
}

// --- SERVING FRONTEND FILES ---
const DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend');

// Prefer built assets from dist; fall back to raw files for dev
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });
} else {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }
  });
}

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 UniFlow Server is running!`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Web App: http://localhost:${PORT}`);
});
