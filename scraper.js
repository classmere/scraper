'use strict';

/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const async = require('async');
const cheerio = require('cheerio');
const moment = require('moment');
const request = require('request');
String = require('./stringExtensions');

const fs = require('fs');

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';
const COLUMNS_PARAM = '&Columns=abcdefghijklmnopqrstuvwxyz{';


module.exports.test = (callback) => {
  fs.readFile( __dirname + '/cs161.htm', function (_, html) {
    const courseJson = parseCourseFromHTML(html);
    callback(courseJson);
  });
};

module.exports.scrape = (callback) => {
  getCourseUrls(callback);
};

function getCourseUrls(callback) {
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
      return getCoursePage(classURLs, callback);
    }
  });
}

function getCoursePage(classUrls, callback) {
  var index = 1;

  async.eachSeries(classUrls, function(url, asyncCallback) {
    const classUrl = CATALOG_URL + url + COLUMNS_PARAM;
    console.log('Scraping ' + index++ + ' of ' + classUrls.length);
    console.log('URL: ' + classUrl);

    request(classUrl, function scrapeClassPage(error, response, body) {
      if (error) {
        asyncCallback(error);
      }
      else if (response.statusCode !== 200) {
        const error = new Error(`Server response was ${response.statusCode}`);
        asyncCallback(error);
      }
      else {
        console.log(parseCourseFromHTML(body));
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
// Parsers - Course
/////////////////////////////////////////////////

function parseCourseFromHTML(htmlBody) {
  var $ = cheerio.load(htmlBody);

  return {
    title: courseTitle($),
    subjectCode: courseSubjectCode($),
    courseNumber: courseNumber($),
    credits: courseCredits($),
    description: courseDesc($),
    prereqs: [{
      subjectCode: null,
      courseNumber: null
    }],
    sections: courseSections($)
  };
}

// Gets course title from the class site. Regex's follow these steps:
// Select h3, remove abbreviation, remove credits, replace
// non-words/whitespace with whitespace, remove spaces, tabs &
// newlines, turn multiple spaces into one, remove spaces on ends
function courseTitle($) {
  return $('h3').text()
                .replace(/(^[A-Z]{1,4}\s[0-9]{2,3})/, '')
                .replace(/\(([^\)]+)\)/i, '')
                .replace(/[^\w\s]/gi, ' ')
                .stripNewlines()
                .stripExcessSpaces()
                .trim();
}

function courseSubjectCode($) {
  return $('h3').text()
                .trim()
                .match(/^[A-Z]{1,4}\s[0-9]{2,3}/)[0]
                .split(' ')[0];
}

function courseNumber($) {
  return $('h3').text()
                .trim()
                .match(/^[A-Z]{1,4}\s[0-9]{2,3}/)[0]
                .split(' ')[1];
}

function courseCredits($) {
  return $('h3').text()
                .match(/\(([^\)]+)\)/i)[1];
}

function courseDesc($) {
  return $('#aspnetForm').first()
                         .clone()
                         .children()
                         .remove()
                         .end()
                         .text()
                         .stripExcessSpaces()
                         .stripNewlines();
}

function courseSections($) {
  const columnNames = $('th').map(function(_, th) {
    return $(th).text().stripNonAlphabetic().toLowerCase();
  });

  var table = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings');

  const sections = table.find('tr').map(function(i, tr) {
    var s = {};
    $(tr).children().each(function(i, td) {
      s[columnNames[i]] = $(td).html()
                                     .stripNewlines()
                                     .stripExcessSpaces();
    });

    return {
      term: s.term,
      session: s.session,
      crn: s.crn,
      credits: s.cr,
      instructor: s.instructor,
      meetingTimes: [{
        startTime: null,
        endTime: null,
        days: null,
        buildingCode: null,
        roomNumber: null
      }],
      startDate: s.startdate,
      endDate: s.enddate,
      campus: s.campus,
      type: s.type,
      status: s.status,
      enrollmentCapacity: s.cap,
      enrollmentCurrent: s.curr,
      waitlistCapacity: s.wlcap,
      waitlistCurrent: s.wlcurr,
      fees: [{
        amount: null,
        description: null
      }],
      restrictions: s.restrictions,
      comments: s.comments,
      textbookUrl: null
    };
  });

  return sections;
}

/////////////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////////////

// Returns object w/ keys for days, startTime, endTime, startDate & endDate
function parseTableDate(text, sectionDict) {
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

function startTime(text) {
  return moment(text.match(/[0-9]{4}/g)[0], 'HHmm');
}

function endTime(text) {
  return moment(text.match(/[0-9]{4}/g)[1], 'HHmm');
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function endTime(text) {
  
}

function days(text) {
  return text.match(/([A-Z])+/g)[0];
}