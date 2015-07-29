'use strict';

const config   = require('./config');
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;
const request  = require('request');
const cheerio  = require('cheerio');
const async    = require('async');
const moment   = require('moment');

const CATALOG_URL = 'http://catalog.oregonstate.edu/';
const COURSE_SEARCH_URL = CATALOG_URL + 'CourseSearcher.aspx?chr=abg';

/////////////////////////////////////////////////
// DATABASE
/////////////////////////////////////////////////
console.log(process.env.MONGO_URL);
mongoose.connect(process.env.MONGO_URL);
const db = mongoose.connection;

const sectionSchema = new Schema({
  term: String,
  startDate: Date,
  endDate: Date,
  session: String,
  crn: {
    type: Number,
    unique: true,
  },
  sec: Number,
  credits: String,
  instructor: String,
  days: String,
  startTime: Date,
  endTime: Date,
  location: String,
  campus: String,
  type: String,
  status: String,
  enrollCap: Number,
  enrolled: Number,
  waitlistCap: Number,
  waitlisted: Number,
  fees: String,
  restrictions: String,
  comments: String,
});

const courseSchema = new Schema({
  title: {
    type: String,
    unique: true,
  },
  abbr: String,
  credits: String,
  desc: String,
  sections: [sectionSchema],
  updated: {
    type: Date,
    default: Date.now,
  },
  meta: {
    likes: Number,
    dislikes: Number,
  },
});

const Course = mongoose.model('Course', courseSchema);

/////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback) {
  console.log('Connected to MongoDB @ ' + db.host + ':' + db.port);
  getCourseLinks(function scrapeComplete(courses, err) {
    console.log('Scrape complete.');
    db.close();
  });
});

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
      } else if (response.statusCode !== 200) {
        console.error('Reponse status code == ' + response.statusCode);
        asyncCallback();
      } else {
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
  var $ = cheerio.load(htmlBody);

  var course = new Course({
    title: parseTitle($),
    abbr: parseAbbr($),
    credits: parseCredits($),
    desc: parseDesc($),
    sections: parseTable($),
  });

  course.save(function(err) {
    if (err) console.error(err);
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
    var sectionDict = {};
    const td = $(this).children('td');

    td.each(function(i) {
      const data = $(this).text().replace(/\s{2,}/g, ' ').trim();
      const key = formatKey(columnNames[i % columnNames.length]);

      // Parse date
      if (key === 'daytimedate') {
        const text = $(this).text();
        parseTableDate(text, sectionDict);
      } else {
        sectionDict[key] = data;
      }
    });

    const section = createSection(sectionDict);
    sections.push(section);
  });

  // First element will be categories, so remove it
  sections.splice(0, 1);
  return sections;
}

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

function createSection(sectionDict) {
  return {
    term: sectionDict.term,
    startDate: sectionDict.startDate,
    endDate: sectionDict.endDate,
    session: sectionDict.session,
    crn: sectionDict.crn,
    sectionNumber: sectionDict.sec,
    credits: sectionDict.cr,
    instructor: sectionDict.instructor,
    days: sectionDict.days,
    startTime: sectionDict.startTime,
    endTime: sectionDict.endTime,
    location: sectionDict.location,
    campus: sectionDict.campus,
    type: sectionDict.type,
    status: sectionDict.status,
    enrollCap: sectionDict.cap,
    enrolled: sectionDict.curr,
    waitlistCap: sectionDict.wlcap,
    waitlisted: sectionDict.wlavail,
    fees: sectionDict.fees,
    restrictions: sectionDict.restrictions,
    comments: sectionDict.comments,
  };
}
