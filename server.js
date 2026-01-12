
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURATION ---
const PORT = process.env.PORT || 5000;
// Sử dụng URI bạn đã cung cấp
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nhutrunghai:30122005@twitter-free-cluster.d9hq5kr.mongodb.net/?appName=Twitter-Free-Cluster';
const JWT_SECRET = process.env.JWT_SECRET || 'nhutrunghai';

// --- DATABASE CONNECTION ---
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ UniFlow DB Connected Successfully'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: String,
  major: String,
  avatar: String,
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
  startDate: String,
  endDate: String,
  color: String,
  notes: String,
  reminderMinutes: Number
});

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'], default: 'TODO' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
});

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  content: String,
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Event = mongoose.model('Event', EventSchema);
const Task = mongoose.model('Task', TaskSchema);
const Note = mongoose.model('Note', NoteSchema);

// --- MIDDLEWARE: AUTH ---
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// --- API ROUTES ---

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, major, avatar } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ email, password: hashedPassword, fullName, major, avatar });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email, fullName, major, avatar } });
  } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar } });
  } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, req.body, { new: true });
    res.json({ id: user._id, email: user.email, fullName: user.fullName, major: user.major, avatar: user.avatar });
  } catch (e) { res.status(500).json({ message: 'Error updating profile' }); }
});

// Events
app.get('/api/events', auth, async (req, res) => {
  const events = await Event.find({ userId: req.userId });
  res.json(events);
});

app.post('/api/events', auth, async (req, res) => {
  try {
    const event = new Event({ ...req.body, userId: req.userId });
    await event.save();
    res.json(event);
  } catch (e) { res.status(500).json({ message: 'Error creating event' }); }
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
    const task = new Task({ ...req.body, userId: req.userId });
    await task.save();
    res.json(task);
  } catch (e) { res.status(500).json({ message: 'Error creating task' }); }
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    res.json(task);
  } catch (e) { res.status(500).json({ message: 'Error updating task' }); }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
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
    const { eventId, content } = req.body;
    const note = await Note.findOneAndUpdate(
      { userId: req.userId, eventId },
      { content, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(note);
  } catch (e) { res.status(500).json({ message: 'Error saving note' }); }
});

// --- SERVING FRONTEND FILES ---
app.use(express.static(path.join(__dirname, '.')));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 UniFlow Server is running!`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Web App: http://localhost:${PORT}`);
});
