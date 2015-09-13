/*
 * Fetches JSON from the OSU Course Catalog API and saves it to RethinkDB
 */

const request   = require('request');
const r         = require('rethinkdb');
const Q         = require('q');

const CATALOG_API =
'http://catalog.oregonstate.edu/Services/CatalogService.svc/rest';
const COURSE_ENDPOINT =
CATALOG_API + '/courses/all';

let connection;

function connectToRethink() {
  console.log('Connecting to RethinkDB');

  const deferred = Q.defer();
  r.connect({
    host: 'localhost',
    port: 28015,
    db: 'test',
    authKey: '',
  }, function onConnection(err, conn) {
    if (err) {
      deferred.reject(err);
    } else {
      console.log('Connected!');
      connection = conn;
      deferred.resolve();
    }
  });

  return deferred.promise;
}

function downloadCourseJSON() {
  const deferred = Q.defer();
  console.log('Downloading course catalog from ' + COURSE_ENDPOINT);
  request.get(COURSE_ENDPOINT, function handleResponse(error, res, body) {
    if (res.statusCode !== 200) {
      const err = new Error('Got response code: ' +
        res.statusCode +
        ' from server');
      deferred.reject(err);
    } else if (error) {
      deferred.reject(error);
    } else {
      deferred.resolve(body);
    }
  });

  return deferred.promise;
}

function parseJSON(rawJSON) {
  const deferred = Q.defer();
  console.log('Parsing JSON');
  deferred.resolve(JSON.parse(rawJSON));
  return deferred.promise;
}

function insertCourses(rawParsedJSON) {
  console.log('Inserting JSON into RethinkDB');

  return Q.nfcall(
    r.table('rawJSON')
    .insert(rawParsedJSON)
    .run(connection)
  );
}

function main() {
  Q.fcall(connectToRethink)
  .then(downloadCourseJSON)
  .then(parseJSON)
  .then(insertCourses)
  .done();
}

main();
