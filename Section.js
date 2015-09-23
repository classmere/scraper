const thinky = require('./thinky');
const type = thinky.type;

const Section = thinky.createModel('Section', {
  id: type.string(),
  idCourse: type.string(),
  term: type.string().max(4),
  session: type.string(),
  crn: type.number().integer().max(99999),
  credits: [type.number().integer().max(16)],
  instructor: type.string(),
  meetingTimes: [{
    startTime: type.string(),
    endTime: type.string(),
    days: type.string().max(7),
    buildingCode: type.string(),
    roomCode: type.string(),
  }],
  startDate: type.date(),
  endDate: type.date(),
  campus: type.string(),
  type: type.string(),
  status: type.string(),
  capacity: type.number().integer(),
  currentEnrollment: type.number().integer(),
  waitlistCapacity: type.number().integer(),
  waitlistCurrent: type.number().integer(),
  fees: type.string(),
  restrictions: type.string(),
  comments: type.string(),
});

module.exports = Section;

// Relations
const Course = require('./Course');
Section.belongsTo(Course, 'course', 'idCourse', 'id');
