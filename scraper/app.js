const 
  fs          = require('fs'),
  searchParse = require('./searchParse');


searchParse.scrape(function scrapeComplete (courses, error) {
  console.log('Scrape complete. ' + courses.length + 
              ' course records obtained.');
});

