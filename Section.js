const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const sectionSchema = new Schema({
  idCourse: String,
  term: String,
  session: String,
  crn: Number,
  credits: [Number],
  instructor: String,
  meetingTimes: [{
    startTime: String,
    endTime: String,
    days: String,
    buildingCode: String,
    roomNumber: Number
  }],
  startDate: Date,
  endDate: Date,
  campus: String,
  type: String,
  status: String,
  capacity: Number,
  currentEnrollment: Number,
  waitlistCapacity: Number,
  waitlistCurrent: Number,
  fees: [{
    amount: Number,
    description: String
  }],
  restrictions: String,
  comments: String
});

module.exports.Section = mongoose.model('Section', sectionSchema);