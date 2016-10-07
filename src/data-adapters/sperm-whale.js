'use strict';

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const url = process.env.MONGO_URL || 'mongodb://localhost:27017/test';
const connection = MongoClient.connect(url);

/*
 * Exports
 */

module.exports.insertCourse = function(course, cb) {
  connection.then(function(db) {
    const courses = db.collection('courses');
    const oldCourses = db.collection('courses.old');

    courses
    .findOne({
      subjectCode: course.subjectCode,
      courseNumber: course.courseNumber,
      title: course.title
    })
    .then(function insertNewCourseOrAddVersionToOldCourseId(r) {

      const oldId = r ? r['_id'] : null;

      if (oldId == null || oldId == undefined) {
        // Just insert the course if a previous version doesn't exist
        course._version = 1;
        courses.insertOne(course)
        .then(completed);
      } 
      
      else {
        const oldCourse = r;
        course._version = oldCourse._version + 1;
        oldCourse._id = {
          _id: oldId,
          _version: r._version
        };
        oldCourses.insertOne(oldCourse)
        .then(function deleteOldCourseFromCurrentCollection(r) {
          assert.equal(1, r.insertedCount);
          return courses.deleteOne({ _id: r.insertedId._id });
        })
        .then(function putNewCourseInCurrentCollection(r) {
          assert.equal(1, r.deletedCount);
          return courses.insertOne(course);
        })
        .then(completed);
      }
    })
    .catch(errorCallback);
  });

  function completed(r) {
    assert.equal(1, r.insertedCount);
    cb(null, course);
  }
};

module.exports.close = function() {
  connection.then((db) => db.close());
};

/*
 * Internal
 */

function errorCallback(err) {
  console.error(err);
  process.exit(1);
}
