'use strict';

/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const async = require('async');
const cheerio = require('cheerio');
const moment = require('moment');
const request = require('request');
String = require('./stringExtensions');
Number = require('./numberExtensions');

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
    return $(th).text().stripNonAlphanumeric().toLowerCase();
  });

  var table = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings');

  const sections = table.find('tr').map(function(i, tr) {
    var s = {};
    $(tr).children().each(function(i, td) {
      s[columnNames[i]] = $(td).text()
                               .stripNewlines()
                               .stripExcessSpaces();
    });

    return {
      term: term(s.term),
      session: session(s.session),
      crn: crn(s.crn),
      credits: credits(s.cr),
      instructor: instructor(s.instructor),
      meetingTimes: meetingTimes(s.daytimedate, 
                                 s.days, 
                                 s.location),
      startDate: startDate(s.startdate),
      endDate: endDate(s.enddate),
      campus: campus(s.campus),
      type: type(s.type),
      status: status(s.status),
      enrollmentCapacity: enrollmentCapacity(s.cap),
      enrollmentCurrent: enrollmentCurrent(s.curr),
      waitlistCapacity: waitlistCapacity(s.wlcap),
      waitlistCurrent: waitlistCurrent(s.wlcurr),
      fees: fees(s.fees),
      restrictions: restrictions(s.restrictions),
      comments: comments(s.comments),
      textbookUrl: textbookUrl(s.comments)
    };
  });

  return sections;
}

/////////////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////////////


function term(term) {
  return term;
}

function session(session) {
  return session;
}

function crn(crn) {
  return crn;
}

function credits(credits) {
  return credits;
}

function instructor(instructor) {
  return instructor;
}

function meetingTimes(daytimedate, location) {
  if (!daytimedate.match(/\d+/g) || daytimedate.includes('TBA')) return;

  function times(text) {
    return text.match(/[0-9]{4}/g).map((t) => { moment(t, 'HHmm'); });
  }

  function startTimes(text) {
    return times(text).filter((_, i) => { i.isEven(); });
  }

  function endTimes(text) {
    return times(text).filter((_, i) => { i.isOdd(); });
  }

  function days(text) {
    return text.match(/([A-Z])+/g)[0];
  }

  function buildingCodes(text) {
    return text.split(' ').filter((_, i) => { i.isEven(); });
  }

  function roomNumbers(text) {
    return text.split(' ').filter((_, i) => { i.isOdd(); });
  }

  return [].push(startTimes(daytimedate))
           .push(endTimes(daytimedate))
           .push(days(daytimedate))
           .push(buildingCodes(location))
           .push(roomNumbers(location))
           .map((arr) => {
             return {
               startTime: arr[0],
               endTime: arr[1],
               days: arr[2],
               buildingCodes: arr[3],
               roomNumbers: arr[4]
             };
           });
}

function startDate(startDate) {
  return startDate;
}

function endDate(endDate) {
  return endDate;
}

function campus(campus) {
  return campus;
}

function type(type) {
  return type;
}

function status(status) {
  return status;
}

