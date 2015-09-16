'use strict';

/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const r         = require('rethinkdb');
const request   = require('request');
const async     = require('async');

const CATALOG_API =
'http://catalog.oregonstate.edu/Services/CatalogService.svc/rest';
const COURSE_ENDPOINT =
CATALOG_API + '/courses/all';

let connection;

async.waterfall([
  function connectToRethink(callback) {
    console.log('Connecting to RethinkDB');
    r.connect({
      host: 'localhost',
      port: 28015,
      db: 'classmere',
      authKey: '',
    }, callback);
  },
  function onConnection(conn, callback) {
    console.log('Connected to RethinkDB!');
    connection = conn;
    callback(null);
  },
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
        console.log(body);
        callback(null, body);
      }
    });
  },
  function parseJSON(rawJSON, callback) {
    console.log('Parsing JSON');
    callback(null, JSON.parse(rawJSON));
  },
  function insertCourses(rawParsedJSON, callback) {
    console.log('Inserting JSON into RethinkDB');
    r.table('rawCourseJSON')
    .insert(rawParsedJSON)
    .run(connection, callback);
  },
], function finished(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    console.log('Operation completed successfully');
    connection.close()
    .then(process.exit(0));
  }
});
