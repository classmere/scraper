const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const sectionSchema = require('./Section');

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
  sections: [sectionSchema],
  updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', courseSchema);