'use strict';

const Writable = require('stream').Writable;
const ws = new Writable({ objectMode: true });
const scraper = require('./src/scraper');
const database = require('./src/data-adapters/sperm-whale');

ws._write = function (course, enc, next) {
  if (!course) {
    database.close();
  } else {
    database.insertCourse(course, function(err, r) {
      if (!err) {
        console.log(`inserted ${course.subjectCode} ${course.courseNumber}`);
      }
    });
    next();
  }
};

scraper.startScrapeStream().pipe(ws);
