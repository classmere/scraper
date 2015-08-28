const thinky = require('thinky')();
const type   = thinky.type;
const Course = require('./Course').Course;

const Section = thinky.createModel('Section', {
  id: type.string(),
  idCourse: type.string(),
  term: type.string().max(4),
  session: type.string(),
  crn: type.number().integer().max(99999),
  section: type.number().integer().max(999),
  credits: type.number().integer().max(16), // TODO: make this array of credit range
  instructor: type.string(),
  startTime: type.string(),
  endTime: type.string(),
  days: type.string().max(5),
  startDate: type.date(),
  endDate: type.date(),
  location: type.string(),
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

Section.belongsTo(Course, 'course', 'idCourse', 'id');

exports.Section = Section;

