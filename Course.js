const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const courseSchema = new Schema({
  title: String,
  subjectCode: String,
  courseNumber: Number,
  credits: [Number],
  description: String,
  prereqs: [{
    subjectCode: String,
    courseNumber: Number
  }],
  updated: { type: Date, default: Date.now }
});

module.exports.Course = mongoose.model('Course', courseSchema);