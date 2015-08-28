'use strict';

const thinky   = require('thinky')();
const request  = require('request');
const cheerio  = require('cheerio');
const async    = require('async');
const moment   = require('moment');
const _        = require('underscore');
const argv     = require('yargs').argv;

const Course   = require('./schemas').Course;
const Section  = require('./schemas').Section;

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';
const SAVE = !argv.nosave;

if (argv.help) {
  console.log('OSU Course Catalog scraper. Supply a Postgres database to ' +
  'save into with -db or supply a DB_URL environment var. Skip saving with ' +
  '--nosave option.');
  process.exit();
}

getCourseLinks(function scrapeComplete() {
  console.log('Scrape complete!');
  process.exit();
});

/*
 * DATABASE
 */

function insertCourseAndSections(courseObject, sectionObjects) {

  // Insert a Course
  const course = new Course({
    title: courseObject.title,
    abbr: courseObject.abbr,
    credits: courseObject.credits,
    description: courseObject.description,
  });

  // Iterate through the array of sectionObjects and insert each
  const sections = sectionObjects.map(function(s) {
    const section = new Section({
      term: s.term,
      session: s.session,
      crn: s.crn,
      section: s.sec,
      credits: s.cr,
      instructor: s.instructor,
      startTime: s.startTime,
      endTime: s.endTime,
      days: s.days,
      startDate: s.startDate,
      endDate: s.endDate,
      location: s.location,
      campus: s.campus,
      type: s.type,
      status: s.status,
      capacity: s.cap,
      currentEnrollment: s.curr,
      waitlistCapacity: s.wlcap,
      waitlistCurrent: s.wlcurr,
      fees: s.fees,
      restrictions: s.restrictions,
      comments: s.comments,
    });

    // Join sections with their course
    section.course = course;
    return section;
  });
  course.sections = sections;
  course.saveAll()
}

/*
 * MAIN
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
 * PARSERS
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

/**
 * Parses a table of class sections
 * @param {object} $ - Cheerio object loaded with a course page's HTML
 * @returns {object} Dictionary containing key: value pairs of scraped table
 */

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
    .match(/([A-Z])+/g)[0];

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
 * HELPER FUNCTIONS
 */

function trimNewlines(desc) {
  var n = desc.indexOf('\n');
  n = n === -1 ? desc.length : n;
  return desc.substring(0, n);
}

function formatKey(key) {
  return key.toLowerCase().replace(/[^A-z]/g, '');
}
