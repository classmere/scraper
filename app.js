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
  let pendingInserts = 0;
  let endEmitted = false;

  stream.on('data', (course) => {
    pendingInserts++;
    database.insertCourse(course, function(err) {
      if (err) {
        database.close();
        process.err(err);
      } else {
        console.log(`inserted ${course.subjectCode} ${course.courseNumber}`);
        pendingInserts--;
        if (endEmitted && pendingInserts == 0) {
          console.log(`done.`);
          database.close();
          process.exit();
        }
      }
    });
  });

  stream.on('end', () => {
    endEmitted = true;
  });
}

