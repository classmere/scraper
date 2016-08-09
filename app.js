'use strict';

const scraper = require('./src/scraper');
const database = require('./src/data-adapters/sperm-whale');

const stream = scraper.startScrapeStream();

stream.on('data', (course) => {
  database.insertCourse(course, function(err, r) {
    if (err) {
      database.close();
      process.err(err);
    } else {
      console.log(`inserted ${course.subjectCode} ${course.courseNumber}`);
    }
  });
});

stream.on('end', () => {
  console.log('done');
  database.close();
  process.exit();
});