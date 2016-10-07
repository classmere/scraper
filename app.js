'use strict';

const scraper = require('./src/scraper');
const stream = scraper.startScrapeStream();
const Transform = require('stream').Transform;

const stringify = new Transform({
  writableObjectMode: true,

  transform(chunk, encoding, callback) {
    callback(null, JSON.stringify(chunk));
  }
});

if (process.argv.includes('--console')) {
  // Pipe output to stdout for debugging purposes
  stream.pipe(stringify, { objectMode: true })
        .pipe(process.stdout);
} else {
  // Pipe output to database
  const database = require('./src/data-adapters/sperm-whale');
  stream.on('data', (course) => {
    database.insertCourse(course, function(err) {
      if (err) {
        database.close();
        process.err(err);
      } else {
        console.log(`inserted ${course.subjectCode} ${course.courseNumber}`);
      }
    });
  });

  stream.on('end', () => {
    console.log('done.');
    database.close();
    process.exit();
  });
}

