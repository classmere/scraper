const thinky = require('./thinky');
const type = thinky.type;

const Course = thinky.createModel('Course', {
  id: type.string(),
  title: type.string().required(),
  subjectCode: type.string().max(6).required(),
  courseNumber: type.number().integer().max(999).required(),
  credits: [type.number().integer().max(16)],
  description: type.string(),
  prereqs: {
    subjectCode: type.string().max(6),
    courseNumber: type.number().integer().max(999),
  },
  dateScraped: type.date().default(Date.now()),
});

// Indexes
Course.ensureIndex('abbr');

module.exports = Course;

// Relations
const Section = require('./Section');
Course.hasMany(Section, 'sections', 'id', 'idCourse');
