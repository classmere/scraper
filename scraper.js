'use strict';

const pg       = require('pg').native;
const request  = require('request');
const cheerio  = require('cheerio');
const async    = require('async');
const moment   = require('moment');

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';

/////////////////////////////////////////////////
// DATABASE
/////////////////////////////////////////////////

const PG_URL = process.argv[2] || process.env.DATABASE_URL;
const client = new pg.Client(PG_URL);

client.connect(function(err) {
  if (err) {
    console.error('could not connect to postgres', err);
    process.exit();
  } else {
    console.log('Connected to PostgreSQL');
    getCourseLinks(function(courses, err) {
      console.log('Scrape complete.');
      client.end();
    });
  }
});

client.on('error', function(err) {
  console.error('PG ERROR ' + err);
  process.exit();
});

/////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////

// Scrapes the search page for links to all course pages
function getCourseLinks(callback) {
  request(COURSE_SEARCH_URL, function parseSearchPage(error, res, body) {
    if (!error && res.statusCode === 200) {
      var classURLs = [];
      var $ = cheerio.load(body);

      $('a[id^=\'ctl00_ContentPlaceHolder\']').each(function(i, element) {
        var link = $(this).attr('href');
        classURLs.push(link);
      });

      // First two elements are currently trash, don't attempt to scrape
      classURLs.splice(0, 2);
      return getCourseInfo(CATALOG_URL, classURLs, callback);
    }
  });
}

// Loads each course page into cheerio and calls parseCourse on it
function getCourseInfo(baseURL, classURLs, callback) {
  var index = 1;

  async.eachSeries(classURLs, function(url, asyncCallback) {
    const classURL = baseURL + url;
    console.log('Scraping ' + index++ + ' of ' + classURLs.length);
    console.log('URL: ' + classURL);

    request(classURL, function(error, response, body) {
      if (error) {
        console.error('Error scraping ' + classURL + '\n' + error);
      } else if (response.statusCode !== 200) {
        console.error('Reponse status code == ' + response.statusCode);
      } else {
        const $ = cheerio.load(body);
        parseCourse($);

        // parseSection($);
      }

      asyncCallback();
    });
  },

  function doneScraping(err) {
    if (err) {
      console.error('An error occured scraping: ' + err);
    } else {
      callback();
    }
  });
}

/////////////////////////////////////////////////
// PARSERS
/////////////////////////////////////////////////

function parseCourse($) {
  var insertCourse = client.query({
    text: 'INSERT INTO course (' +
      'abbr,' +
      'title,' +
      'credits,' +
      'description' +
    ') VALUES ($1, $2, $3, $4)',
    values: [
      parseAbbr($),
      parseTitle($),
      parseCredits($),
      parseDesc($),
    ],
    name: 'insert course',
  });

  insertCourse.on('row', function(row) {
    console.log(row);

    // insert sections here using course key
  });

  insertCourse.on('error', function(err) {
    console.error(err);
  });
}

// Gets course title from the class site. Regex's follow these steps:
// Select h3, remove abbreviation, remove credits, replace
// non-words/whitespace with whitespace, remove spaces, tabs &
// newlines, turn multiple spaces into one, remove spaces on ends
function parseTitle($) {
  var title = $('h3').text();
  title = title.replace(/(^[A-Z]{1,4}\s[0-9]{2,3})/, '');
  title = title.replace(/\(([^\)]+)\)/i, '');
  title = title.replace(/[^\w\s]/gi, ' ');
  title = title.replace(/\r?\n|\r|\t/g, '');
  title = title.replace(/\ {2,}/g, ' ');
  return title.trim();
}

// Gets course abbreviation from the class site
function parseAbbr($) {
  return $('h3').text().trim().match(/^[A-Z]{1,4}\s[0-9]{2,3}/)[0];
}

// Gets credits from the class site
function parseCredits($) {
  return $('h3')
  .text()
  .match(/\(([^\)]+)\)/i)[1]
  .split('-');
}

// Gets course description from the class site
function parseDesc($) {
  var desc = $('#aspnetForm').first()
                             .clone()
                             .children()
                             .remove()
                             .end()
                             .text()
                             .trim();
  desc = trimNewlines(desc);
  return desc;
}

// Parses table of class sections
function parseSection($) {
  var columnNames = [];
  $('th').each(function(i, element) {
    var columnName = $(this).text().replace(/\r?\n|\r|\t/g, '');
    columnName = columnName.replace(/\ {2,}/g, '');
    columnNames.push(columnName);
  });

  var tableRows = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings > tr ');
  var sections = [];

  tableRows.each(function(i, element) {
    var sectionDict = {};
    const td = $(this).children('td');

    td.each(function(i) {
      const data = $(this).text().replace(/\s{2,}/g, ' ').trim();
      const key = formatKey(columnNames[i % columnNames.length]);

      // Parse date
      if (key === 'daytimedate') {
        const text = $(this).text();
        parseSectionDate(text, sectionDict);
      } else {
        sectionDict[key] = data;
      }
    });
  });

  // First element will be categories, so remove it
  sections.splice(0, 1);
  return sections;
}

// Returns object w/ keys for days, startTime, endTime, startDate & endDate
function parseSectionDate(text, sectionDict) {
  if (text.match(/\d+/g) && text.indexOf('TBA') === -1) {
    sectionDict.days = text
    .match(/([A-Z])+/g)[0];
    sectionDict.startTime = moment(text
    .match(/[0-9]{4}/g)[0], 'HHmm');
    sectionDict.endTime = moment(text
    .match(/[0-9]{4}/g)[1], 'HHmm');
    sectionDict.startDate = text
    .match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[0];
    sectionDict.endDate = text
    .match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[1];
  }
}

/////////////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////////////

function trimNewlines(desc) {
  var n = desc.indexOf('\n');
  n = n === -1 ? desc.length : n;
  return desc.substring(0, n);
}

function formatKey(key) {
  return key.toLowerCase().replace(/[^A-z]/g, '');
}
