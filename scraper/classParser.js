const
  cheerio = require('cheerio');


exports.parseCourseFromHTML = parseCourseFromHTML;


function parseCourseFromHTML (htmlBody) {
  $ = cheerio.load(htmlBody);

  var course = {};

  course.title = parseTitle($);
  course.abbr = parseAbbr($);
  course.credits = parseCredits($);
  course.desc = parseDesc($);
  course.sections = parseTable($);

  return course;
}

// Gets the title from the class site
function parseTitle ($) {
  var title = $('h3').text().trim();
  // Remove the abbreviation
  title = title.replace(/(^[A-Z]{1,4}\s[0-9]{2,3})/, '');
  // Remove credits
  title = title.replace(/\(([^\)]+)\)/i, '');
  // Replace non-words/whitespace with whitespace
  title = title.replace(/[^\w\s]/gi, ' ');
  // Remove spaces, tabs, newlines
  title = title.replace(/\r?\n|\r|\t/g, '');
  // Turn multiple spaces into just one, remove spaces on ends
  title = title.replace(/\ {2,}/g, ' ');
  return title.trim();
}

// Gets the abbreviation from the class site
function parseAbbr ($) {
  return $('h3').text().trim().match(/^[A-Z]{1,4}\s[0-9]{2,3}/)[0];
}

// Gets the credits from the class site
function parseCredits ($) {
  return $('h3').text().match(/\(([^\)]+)\)/i)[1];
}

// Gets the description from the class site
function parseDesc ($) {
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

// Parses the table of class meeting times
function parseTable ($) {
  var attribs = [];
  $('th').each(function (i, element) {
    var attrib = $(this).text().replace(/\r?\n|\r|\t/g, '');
    attrib = attrib.replace(/\ {2,}/g, '');
    attribs.push(attrib);
  });

  tableRows = $('#ctl00_ContentPlaceHolder1_SOCListUC1_gvOfferings > tr ');

  var sections = [];

  tableRows.each(function (i, element) {
    var classDict = {};

    td = $(this).children('td');

    td.each(function (i) {
      var data = $(this).text().replace(/\s{2,}/g, ' ').trim();
      var key = formatKey(attribs[i % attribs.length]);

      // Parse date
      if (key === "daytimedate") {
        const text = $(this).text();
        parseTableDate(text, classDict);
      }
      else {
        classDict[key] = data;
      }
    });
    sections.push(classDict);
  });
  // First element will be categories, so remove it
  sections.splice(0, 1);
  return sections;
}

function parseTableDate(text, classDict) {
  if (text.match(/\d+/g) && text.indexOf('TBA') === -1) {
    classDict.m = text.indexOf('M') > -1; 
    classDict.t = text.indexOf('T') > -1;
    classDict.w = text.indexOf('W') > -1;
    classDict.r = text.indexOf('R') > -1;
    classDict.f = text.indexOf('F') > -1;

    classDict.starttime = 
      text.match(/[0-9]{4}/g)[0] + '00';
    classDict.endtime   = 
      text.match(/[0-9]{4}/g)[1] + '00';
    classDict.startdate = 
      text.match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[0];
    classDict.enddate   = 
      text.match(/[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}/g)[1];
  }
  else {
    classDict.m = null;
    classDict.t = null;
    classDict.w = null;
    classDict.r = null;
    classDict.f = null;

    classDict.starttime = null;
    classDict.endtime   = null;
    classDict.startdate = null;
    classDict.enddate   = null;
  }
}


/////////////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////////////

function trimNewlines (desc) {
  var n = desc.indexOf('\n');
  n = n === -1 ? desc.length : n;
  return desc.substring(0, n);
}

function formatKey(key) {
  return key.toLowerCase().replace(/[^A-z]/g, '');
}


