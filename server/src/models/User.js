const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  profilePic: {
    type: String,
  },
  organisations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
