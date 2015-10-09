'use strict';

/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const request   = require('request');
const async     = require('async');
const thinky    = require('./thinky');
const moment    = require('moment');

const Course    = require('./Course');
const Section   = require('./Section');

const CATALOG_API =
'http://catalog.oregonstate.edu/Services/CatalogService.svc/rest';
const COURSE_ENDPOINT = CATALOG_API + '/courses/all';
const SECTION_ENDPOINT = CATALOG_API + '/course';

// Helper functions

function sectionMeetingTimesFromMeetingTimeJSONArray(meetingTimeJSONArray) {
  if (typeof meetingTimeJSONArray === 'undefined') {
    return null;
  }
  const meetingTimeArray = meetingTimeJSONArray.map((meetingTimeJSON) => {
    return {
      startTime: moment(meetingTimeJSON.BeginTime, 'HHmm').format() || null,
      endTime: moment(meetingTimeJSON.EndTime, 'HHmm').format() || null,
      days: meetingTimeJSON.DaysOfTheWeek || null,
      buildingCode: meetingTimeJSON.BuildingCode || null,
      roomNumber: meetingTimeJSON.RoomCode || null,
    };
  });
  return meetingTimeArray;
}

function sectionSchemasFromSectionJSON(sectionsJSON) {
  if (typeof sectionsJSON === 'undefined') {
    return null;
  }
  const sections = sectionsJSON.map(function createSection(sectionJSON) {
    const creditArray = [];
    if (typeof sectionJSON.CreditLow !== 'undefined') {
      creditArray.push(sectionJSON.CreditLow);
    }
    if (typeof sectionJSON.CreditHigh !== 'undefined') {
      creditArray.push(sectionJSON.CreditHigh);
    }
    function calculateCurrent(maximum, available) {
      const current = parseInt(maximum, 10) - parseInt(available, 10);
      return (isNaN(current) || current < 0) ? 0 : current;
    }

    return new Section({
      term: sectionJSON.TermShortDescription || null,
      session: sectionJSON.Session || null,
      crn: sectionJSON.CRN || null,
      credits: creditArray || null,
      instructor: sectionJSON.Instructor || null,
      meetingTimes: sectionMeetingTimesFromMeetingTimeJSONArray(
        sectionJSON.MeetingTimes
      ) || null,
      startDate: moment(sectionJSON.StartDate).format() || null,
      endDate: moment(sectionJSON.EndDate).format() || null,
      campus: sectionJSON.Campus || null,
      type: sectionJSON.ScheduleType || null,
      status: sectionJSON.Status || null,
      capacity: sectionJSON.MaxEnrollment || null,
      currentEnrollment: calculateCurrent(sectionJSON.MaxEnrollment, sectionJSON.AvailableEnrollment) || null,
      waitlistCapacity: sectionJSON.MaxWait || null,
      waitlistCurrent: calculateCurrent(sectionJSON.MaxWait, sectionJSON.AvailableWait) || null,
      fees: null,
      restrictions: null,
      comments: sectionJSON.Comments || null,
    });
  });
  return sections;
}

// Meaty functions

function downloadCourseJSON(callback) {
  console.log('Downloading course catalog from ' + COURSE_ENDPOINT);

  request.get(COURSE_ENDPOINT, function handleResponse(error, res, body) {
    if (res.statusCode !== 200) {
      err = new Error('Got response code: ' +
        res.statusCode +
        ' from server');
      callback(err);
    } else if (error) {
      callback(error);
    } else {
      const courseJSON = JSON.parse(body).slice(1);
      callback(null, courseJSON);
    }
  });
}

function courseSchemasFromCourseJSON(coursesJSON, callback) {
  console.log('Creating Course Schemas');

  const courses = coursesJSON.map((courseJSON) => {
    let prereqs = [];
    if (typeof courseJSON.CoursePrereqs !== 'undefined') {
      prereqs = courseJSON.CoursePrereqs.map((prereqJSON) => {
        return {
          subjectCode: prereqJSON.SubjectCode,
          courseNumber: prereqJSON.CourseNumber,
        };
      });
    }

    const creditArray = [];
    if (typeof courseJSON.CreditLow !== 'undefined') {
      creditArray.push(courseJSON.CreditLow);
    }
    if (typeof courseJSON.CreditHigh !== 'undefined') {
      creditArray.push(courseJSON.CreditHigh);
    }

    const course = new Course({
      title: courseJSON.Title,
      subjectCode: courseJSON.SubjectCode,
      courseNumber: courseJSON.CourseNumber,
      credits: creditArray,
      description: courseJSON.Description,
      prereqs: prereqs,
      dateScraped: Date.now(),
    });

    return course;
  });

  callback(null, courses);
}

function downloadSectionJSON(courseSchemas, callback) {
  console.log('Downloading section JSON');
  let sectionsJSON = [];
  async.eachLimit(
    courseSchemas,
    10, // Limit number of requests to not DDOS OSU's api
    function getCourse(course, innerCallback) {
      const ref = '/' + course.subjectCode + '/' + course.courseNumber;
      const fullRef = SECTION_ENDPOINT + ref;
      request.get(fullRef, function handleResponse(error, res, body) {
        console.log('Parsing course: ' +
          course.subjectCode +
          ' ' +
          course.courseNumber
        );
        if (error || body === null) {
          error.message = 'Error occurred calling ' + fullRef;
          console.error(error);
        } else if (res.statusCode !== 200) {
          const err = new Error('Got response code: ' +
            res.statusCode +
            ' from server');
          console.error(err);
        } else {
          try {
            sectionsJSON = JSON.parse(body).Offerings;
            course.sections = sectionSchemasFromSectionJSON(sectionsJSON);
          } catch (err) {
            console.error(err);
          }
        }
        innerCallback();
      });
    },
    function finishedGettingSections(err) {
      callback(err, courseSchemas, sectionsJSON);
    });
}

function insertCourses(courses, callback) {
    // saves each course, calls callback when finished
  console.log('Inserting ' + courses.length + ' courses into RethinkDB');
  async.each(
    courses,
    function insertCourse(course, innerCallback) {
      try {
        course.validate();
      } catch (err) {
        console.error(err);
        innerCallback();
        return;
      }

      course.saveAll(function doneSaving(err) {
        if (err) {
          console.error(err);
        }
        innerCallback();
      });
    },
    callback
  );
}

module.exports = function main() {
  async.waterfall([
    downloadCourseJSON,
    courseSchemasFromCourseJSON,
    downloadSectionJSON,
    insertCourses,
  ], function finished(err) {
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      console.log('Operation completed successfully');
      thinky.r.getPool().drain();
    }
  });
};
