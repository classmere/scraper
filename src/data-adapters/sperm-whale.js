'use strict';

const MongoClient = require('mongodb').MongoClient;

const url = 'mongodb://localhost:27017/test';
const connection = MongoClient.connect(url);

module.exports.insertCourse = function(course, cb) {
  connection
    .then(function(db) {
      const courses = db.collection('courses');
      courses.insertOne(course, (err, r) => {
        if (err) {
          cb(err);
        } else {
          cb(null, r);
        }
      });
    })
    .catch(function(err) {
      process.exit(err);
    });
};

module.exports.close = function() {
  connection.then((db) => db.close());
};
