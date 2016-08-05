const scraper = require('./scraper');

scraper.scrape(function(courseJson) {
  console.log(courseJson);
});
