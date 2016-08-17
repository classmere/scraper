'use strict';

/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const cheerio = require('cheerio');
const moment = require('moment');
const request = require('request');

String = require('./stringExtensions');
Number = require('./numberExtensions');

var Readable = require('stream').Readable;
var rs = new Readable({objectMode: true});

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';
const COLUMNS_PARAM = '&Columns=abcdefghijklmnopqrstuvwxyz{';

/*
 * Returns a Node readable stream of scraped courses
 */

module.exports.startScrapeStream = () => {
  const courseUrlsPromise = getCourseUrls();
  const courseUrlsIteratorPromise = courseUrlsPromise.then(function(urls) {
    return urls.values();
  });

  rs._read = function () {
    courseUrlsIteratorPromise.then(function(urlsIterator) {
      const nextUrl = urlsIterator.next().value;
      getCoursePage(nextUrl, function(courseOrNull) {
        nextUrl ? rs.push(courseOrNull) : rs.push(null);
      });
    });
  };
  return rs;
};

/*
 * Returns a set of unique course urls
 */

function getCourseUrls() {
  return new Promise(function(resolve, reject) {
    request(COURSE_SEARCH_URL, function parseSearchPage(error, res, body) {
      if (error) {
        reject(error);
      } else {
        var courseUrls = new Set();
        var $ = cheerio.load(body);

        $('a[id^=\'ctl00_ContentPlaceHolder1_gvResults\']').each(function() {
          var link = $(this).attr('href');
          courseUrls.add(link);
        });

        resolve(courseUrls);
      }
    });
  });
}

function getCoursePage(url, callback) {
  if (!url) {
    return null;
  } else {
    const courseUrl = CATALOG_URL + url + COLUMNS_PARAM;
    request(courseUrl, function scrapeClassPage(error, response, body) {
      if (error) {
        console.error(error);
      }
      else if (response.statusCode !== 200) {
        console.error(`Server response was ${response.statusCode} for GET ${courseUrl}`);
      }
      else {
        const course = parseCourseFromHTML(body);
        callback(course);
      }
    });
  }
}

/*
 * Parsers - Course
 */

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
    updated: new Date(),
    sections: courseSections($)
  };
}

/*
 * Gets course title from the class site. Regex's follow these steps:
 * Select h3, remove abbreviation, remove credits, replace
 * non-words/whitespace with whitespace, remove spaces, tabs &
 * newlines, turn multiple spaces into one, remove spaces on ends 
 */

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

  // Exclude first row since it only consists of column names
  var tableRows = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings').find('tr')
                                                                        .slice(1);

  const sections = tableRows.map(function(i, tr) {
    var s = {};
    $(tr).children().each(function(i, td) {
      s[columnNames[i]] = $(td).text()
                               .stripNewlines()
                               .stripExcessSpaces();
    });

    const parse = new Parse();

    return {
      term: parse.term(s.term),
      session: parse.session(s.session),
      crn: parse.crn(s.crn),
      credits: parse.credits(s.cr),
      instructor: parse.instructor(s.instructor),
      meetingTimes: parse.meetingTimes(s.daytimedate, 
                                 s.location),
      startDate: parse.startDate(s.startdate),
      endDate: parse.endDate(s.enddate),
      campus: parse.campus(s.campus),
      type: parse.type(s.type),
      status: parse.status(s.status),
      enrollmentCapacity: parse.enrollmentCapacity(s.cap),
      enrollmentCurrent: parse.enrollmentCurrent(s.curr),
      waitlistCapacity: parse.waitlistCapacity(s.wlcap),
      waitlistCurrent: parse.waitlistCurrent(s.wlcurr),
      fees: parse.fees(s.fees),
      restrictions: parse.restrictions(s.restrictions),
      comments: parse.comments(s.comments),
      textbookUrl: parse.textbookUrl(s.comments)
    };
  });

  return sections.toArray();
}

class Parse {
  term(term) {
    return term;
  }

  session(session) {
    return session;
  }

  crn(crn) {
    return crn;
  }

  credits(credits) {
    return credits;
  }

  instructor(instructor) {
    return instructor;
  }

  meetingTimes(daytimedate, location) {
    if (!daytimedate.match(/\d+/g) || daytimedate.includes('TBA')) return;

    function times(text) {
      return text.match(/[0-9]{4}/g).map((t) => { return moment(t, 'HHmm'); });
    }

    function startTimes(text) {
      return times(text).filter((_, i) => { return i.isEven(); });
    }

    function endTimes(text) {
      return times(text).filter((_, i) => { return i.isOdd(); });
    }

    function days(text) {
      return text.match(/([A-Z])+/g);
    }

    function buildingCodes(text) {
      return text.split(' ').filter((_, i) => { return i.isEven(); });
    }

    function roomNumbers(text) {
      return text.split(' ').filter((_, i) => { return i.isOdd(); });
    }

    return startTimes(daytimedate).map((_, i) => {
      return {
        startTime: startTimes(daytimedate)[i].format(),
        endTime: endTimes(daytimedate)[i].format(),
        days: days(daytimedate)[i],
        buildingCode: buildingCodes(location)[i],
        roomNumber: roomNumbers(location)[i]
      };
    });
  }

  startDate(startDate) {
    return startDate;
  }

  endDate(endDate) {
    return endDate;
  }

  campus(campus) {
    return campus;
  }

  type(type) {
    return type;
  }

  status(status) {
    return status;
  }

  enrollmentCapacity (cap) {
    return cap;
  }

  enrollmentCurrent (curr) {
    return curr;
  }

  waitlistCapacity (wlcap) {
    return wlcap;
  }

  waitlistCurrent (wlcurr) {
    return wlcurr;
  }

  fees (fees) {
    return fees;
  }

  restrictions (restrictions) {
    return restrictions;
  }

  comments (comments) {
    return comments;
  }

  textbookUrl (comments) {
    return comments;
  }
}

module.exports.Parse = Parse;
