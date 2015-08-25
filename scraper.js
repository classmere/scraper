'use strict';

const pg       = require('pg').native;
const request  = require('request');
const cheerio  = require('cheerio');
const async    = require('async');
const moment   = require('moment');
const _        = require('underscore');
const argv     = require('yargs').argv;

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';
const SAVE = !argv.nosave;

if (argv.help) {
  console.log('OSU Course Catalog scraper. Supply a Postgres database to ' +
  'save into with -db or supply a DB_URL environment var. Skip saving with ' +
  '--nosave option.');
  process.exit();
}

/*
  DATABASE
*/

const PG_URL = argv.db || process.env.DATABASE_URL;
const client = new pg.Client(PG_URL);

if (SAVE) {
  client.connect(function(err) {
    if (err) {
      console.error('could not connect to postgres', err);
      process.exit();
    } else {
      console.log('Connected to PostgreSQL');
      getCourseLinks(function(courses, err) {
        console.log('Scrape complete.');
        client.on('drain', client.end.bind(client));
      });
    }
  });

  client.on('error', function(err) {
    throw(err);
  });

} else {
  getCourseLinks(function(courses, err) {
    console.log('Scrape complete.');
  });
}

function insertCourseAndSections(courseObject, sectionObjects) {
  var courseInsertion = insertCourse(courseObject, function(key) {
    insertSections(sectionObjects, key);
  });
}

function insertCourse(courseObject, callback) {
  const course = courseObject;
  var query = client.query({
    text: 'INSERT INTO course (' +
      'abbr,' +
      'title,' +
      'credits,' +
      'description' +
    ') VALUES ($1, $2, $3, $4)' +
    'RETURNING id',
    values: [
      course.abbr,
      course.title,
      course.credits,
      course.description,
    ],
    name: 'insert course',
  });

  query.on('row', function(row) {
    const id = row.id;
    callback(id);
  });

  query.on('error', function(err) {
    console.error(err);
  });
}

function insertSections(sectionObjectArray, courseId) {
  _.each(sectionObjectArray, function(sectionObject) {
    insertSection(sectionObject, courseId);
  });
}

function insertSection(sectionObject, courseId) {
  const section = sectionObject;

  var query = client.query({
    text: 'INSERT INTO section (' +
      'crn,' +
      'course_id,' +
      'term,' +
      'start_date,' +
      'end_date,' +
      'section,' +
      'session,' +
      'credits,' +
      'instructor,' +
      'days,' +
      'start_time,' +
      'end_time,' +
      'location,' +
      'campus,' +
      'type,' +
      'status,' +
      'capacity,' +
      'enrolled,' +
      'waitlist_cap,' +
      'waitlist_current,' +
      'fees,' +
      'restrictions,' +
      'comments' +
    ') VALUES (' +
      '$1 , $2 , $3 , $4 , $5 , $6 , $7 , $8 , $9 , $10,' +
      '$11, $12, $13, $14, $15, $16, $17, $18, $19, $20,' +
      '$21, $22, $23' +
    ')',
    values: [
      section.crn,
      courseId,
      section.term,
      section.startDate,
      section.endDate,
      section.sec,
      section.session,
      section.cr,
      section.instructor,
      section.days,
      section.startTime,
      section.endTime,
      section.location,
      section.campus,
      section.type,
      section.status,
      section.cap,
      section.curr,
      section.wlcurr,
      section.wlcap,
      section.fees,
      section.restrictions,
      section.comments,
    ],
    name: 'insert section',
  });

  query.on('error', function(err) {
    console.error(err);
  });
}

/*
  MAIN
*/
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

        const courseObject = parseCourse($);
        var sectionObjects = parseSections($);
        if (SAVE) {
          insertCourseAndSections(courseObject, sectionObjects);
        }
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

/*
  PARSERS
*/

function parseCourse($) {
  return {
    abbr: parseAbbr($),
    title: parseTitle($),
    credits: parseCredits($),
    description: parseDesc($),
  };
}

// Gets course title from the class site. Regex's follow these steps:
// Select h3, remove abbreviation, remove credits, replace
// non-words/whitespace with whitespace, remove spaces, tabs &
// newlines, turn multiple spaces into one, remove spaces on ends
function parseTitle($) {
  var title = $('h3').text();
  title = title.trim();
  title = title.replace(/(^[A-Z]{1,4}\s[0-9]{2,3})/, '');
  title = title.replace(/\(([^\)]+)\)/i, '');
  title = title.replace(/[^\w\s]/gi, ' ');
  title = title.replace(/\r?\n|\r|\t/g, '');
  title = title.replace(/\ {2,}/g, ' ');
  return title;
}

// Gets course abbreviation from the class site
function parseAbbr($) {
  return $('h3').text().trim().match(/^[A-Z]{1,4}\s[0-9]{2,3}/)[0];
}

// Gets credits from the class site and parses string array to integer array
function parseCredits($) {
  return $('h3')
  .text()
  .match(/\(([^\)]+)\)/i)[1]
  .split('-')
  .map(function(value) {
    return parseInt(value, 10);
  });
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
function parseSections($) {
  var columnNames = [];
  $('th').each(function(i, element) {
    var columnName = $(this).text().replace(/\r?\n|\r|\t/g, '');
    columnName = columnName.replace(/\ {2,}/g, '');
    columnNames.push(columnName);
  });

  var tableRows = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings > tr ');
  var sections = [];

  tableRows.each(function parseSection(i, element) {
    var sectionDict = {};
    const td = $(this).children('td');

    td.each(function(i) {
      // Trim is likely not necessary
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

    sections.push(sectionDict);
  });

  // First element will be categories, so remove it
  sections.splice(0, 1);
  return sections;
}

// Returns object w/ keys for days, startTime, endTime, startDate & endDate
function parseSectionDate(text, sectionDict) {
  if (text.match(/\d+/g) && text.indexOf('TBA') === -1) {
    sectionDict.days = text
    .match(/([A-Z])+/g)[0].split('');

    sectionDict.startTime = moment(text
    .match(/[0-9]{4}/g)[0], 'HHmm')
    .format('HH:mm:ss');

    sectionDict.endTime = moment(text
    .match(/[0-9]{4}/g)[1], 'HHmm')
    .format('HH:mm:ss');

    sectionDict.startDate = text
    .match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[0];

    sectionDict.endDate = text
    .match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[1];
  }
}

/*
  HELPER FUNCTIONS
*/

function trimNewlines(desc) {
  var n = desc.indexOf('\n');
  n = n === -1 ? desc.length : n;
  return desc.substring(0, n);
}

function formatKey(key) {
  return key.toLowerCase().replace(/[^A-z]/g, '');
}
