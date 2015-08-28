const thinky = require('thinky')();
const type   = thinky.type;

const Course = thinky.createModel('Course', {
  id: type.string(),
  title: type.string().required(),
  abbr: type.string().max(10).required(),
  credits: [type.number()],
  description: type.string(),
});

exports.Course = Course;