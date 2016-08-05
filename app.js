const scraper = require('./src/scraper');

scraper.scrape(function(courseJson) {
  console.log(courseJson);
});
