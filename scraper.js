'use strict';

const config   = require('./config');
const oio      = require('orchestrate');
const request  = require('request');
const cheerio  = require('cheerio');
const async    = require('async');
const moment   = require('moment');

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';

/////////////////////////////////////////////////
// DATABASE
/////////////////////////////////////////////////

const db = oio(config.token, config.server);

// Saves a course to Orchestrate
function postCourse($) {
  const key = parseAbbr($).replace(/\s+/g, '');

  db.put('courses',  key, {
    title: parseTitle($),
    credits: parseCredits($),
    desc: parseDesc($)
  })
  .then(function(result) {
    postSection($, key);
  })
  .fail(function(err) {
    console.error(err);
  });
}

// Saves a section to Orchestrate
function postSection($, courseKey) {
  const sections = parseTable($);

  sections.forEach(function(section) {
    db.put('sections', section.crn, {
      term: section.term,
      startDate: section.startDate,
      endDate: section.endDate,
      session: section.session,
      crn: section.crn,
      sectionNumber: section.sec,
      credits: section.cr,
      instructor: section.instructor,
      days: section.days,
      startTime: section.startTime,
      endTime: section.endTime,
      location: section.location,
      campus: section.campus,
      type: section.type,
      status: section.status,
      enrollCap: section.cap,
      enrolled: section.curr,
      waitlistCap: section.wlcap,
      waitlisted: section.wlavail,
      fees: section.fees,
      restrictions: section.restrictions,
      comments: section.comments
    })
    .then(function(result) {
      const sectionKey = result.path.key;
      linkSectionToCourse(sectionKey, courseKey);
    })
    .fail(function(err) {
      console.error(err);
    });
  });
}

// Creates a one-directional relationship between a section and course
function linkSectionToCourse(sectionKey, courseKey) {
  db.newGraphBuilder()
    .create()
    .from('sections', sectionKey)
    .related('parentCourse')
    .to('courses', courseKey)
    .then(function(res) {
      console.log(res.statusCode);
    });
}

/////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////

getCourseLinks(function scrapeComplete(courses, err) {
  console.log('Scrape complete.');
});

function getCourseLinks(callback) {
  request(COURSE_SEARCH_URL, function parseSearchPage(error, res, body) {
    if (!error && res.statusCode === 200) {
      var classURLs = [];
      var $ = cheerio.load(body);

      $('a[id^=\'ctl00_ContentPlaceHolder\']').each(function() {
        var link = $(this).attr('href');
        classURLs.push(link);
      });

      // First two elements are currently trash, don't attempt to scrape
      classURLs.splice(0, 2);
      return getCourseInfo(CATALOG_URL, classURLs, callback);
    }
  });
}

function getCourseInfo(baseURL, classURLs, callback) {
  var index = 1;

  async.eachSeries(classURLs, function(url, asyncCallback) {
    const classURL = baseURL + url;
    console.log('Scraping ' + index++ + ' of ' + classURLs.length);
    console.log('URL: ' + classURL);

    request(classURL, function scrapeClassPage(error, response, body) {
      if (error) {
        console.error('Error scraping ' + classURL + '\n' + error);
        asyncCallback();
      }
      else if (response.statusCode !== 200) {
        console.error('Reponse status code == ' + response.statusCode);
        asyncCallback();
      }
      else {
        parseCourseFromHTML(body);
        asyncCallback();
      }
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

function parseCourseFromHTML(htmlBody) {
  const $ = cheerio.load(htmlBody);
  postCourse($);
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
  return $('h3').text().match(/\(([^\)]+)\)/i)[1];
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
function parseTable($) {
  var columnNames = [];
  $('th').each(function(i, element) {
    var columnName = $(this).text().replace(/\r?\n|\r|\t/g, '');
    columnName = columnName.replace(/\ {2,}/g, '');
    columnNames.push(columnName);
  });

  var tableRows = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings > tr ');
  var sections = [];

  tableRows.each(function(i, element) {
    var section = {};
    const td = $(this).children('td');

    td.each(function(i) {
      const data = $(this).text().replace(/\s{2,}/g, ' ').trim();
      const key = formatKey(columnNames[i % columnNames.length]);

      // Parse date
      if (key === 'daytimedate') {
        const text = $(this).text();
        parseTableDate(text, section);
      }
      else {
        section[key] = data;
      }
    });

    sections.push(section);
  });

  // First element will be categories, so remove it
  sections.splice(0, 1);
  return sections;
}

// Returns object w/ keys for days, startTime, endTime, startDate & endDate
function parseTableDate(text, section) {
  if (text.match(/\d+/g) && text.indexOf('TBA') === -1) {
    section.days = text
    .match(/([A-Z])+/g)[0];
    section.startTime = moment(text
    .match(/[0-9]{4}/g)[0], 'HHmm');
    section.endTime = moment(text
    .match(/[0-9]{4}/g)[1], 'HHmm');
    section.startDate = text
    .match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[0];
    section.endDate = text
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

// Formats a table column to be parsed easily
function formatKey(key) {
  return key.toLowerCase().replace(/[^A-z]/g, '');
}
