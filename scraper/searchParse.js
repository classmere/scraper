const 
  request      = require('request'),
  cheerio      = require('cheerio'),
  async        = require('async'),
  classParser  = require('./classParser'),
  db           = require('../database/db');


const
  CATALOG_URL = 'http://catalog.oregonstate.edu/',
  COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';


exports.scrape = getCourseLinks;


/////////////////////////////////////////////////
// MAIN FUNCTIONS
/////////////////////////////////////////////////

function getCourseLinks (callback) {
  db.connect();
  request(COURSE_SEARCH_URL, function parseSearchPage (error, res, body) {
    if (!error && res.statusCode === 200) {
      var classURLs = [];
      $ = cheerio.load(body);

      $("a[id^='ctl00_ContentPlaceHolder']").each(function (i, element) {
        var link = $(this).attr('href');
        classURLs.push(link);
      });
      // First two elements are currently trash, don't attempt to scrape
      classURLs.splice(0, 2);
      return getCourseInfo(CATALOG_URL, classURLs, callback);
    }
  });
}

function getCourseInfo (baseURL, classURLs, callback) {
  var courses = [];
  var index = 1;

  async.eachSeries(classURLs, function (url, asyncCallback) {

    var classURL = baseURL + url;
    console.log('Scraping ' + index++ + ' of ' + classURLs.length);
    console.log('URL: ' + classURL);

    request(classURL, function scrapeClassPage (error, response, body) {
      if (error) {
        console.error('Error scraping ' + classURL + '\n' + error);
        asyncCallback();
      }
      else if (response.statusCode !== 200) {
        console.error('Reponse status code == ' + response.statusCode);
        asyncCallback();
      }
      else {
        var course = classParser.parseCourseFromHTML(body);
        courses.push(course);

        // wow
        db.insertCourse(course, function (err) {
          if (err) {
            console.error('Error inserting course: ' + err);
            throw err;
          }
          asyncCallback();
        });
      }
    });
  }, function doneScraping (err) {
    if (err) {
      console.error('An error occured scraping: ' + err);
    } else {
      db.disconnect();
      callback(courses);
    }
  });
}


