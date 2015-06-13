"use strict";

const 
  MongoClient = require('mongodb').MongoClient,
  assert      = require('assert'),
  url         = 'mongodb://localhost:27017/test';


exports.insertCourseArray = insertCourseArray;


function connect (callback) {
  MongoClient.connect(url, function (err, db) {
    assert.equal(null, err);
    callback(db);
  });
}

function insertCourse (course, db, callback) {
  db.collection('courses').insert(course, function () {
    callback();
  });
}

function closeConnection (db) {
  db.close();
}

function insertCourseArray (courses, callback) {
  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    db.collection('courses').insertMany(courses, function () {
      db.close();
      callback();
    });
  });
}