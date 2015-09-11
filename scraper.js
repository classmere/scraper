'use strict';

const program   = require('commander');
const request   = require('request');
const r         = require('rethinkdb');
const Q         = require('q');

const CATALOG_API =
'http://catalog.oregonstate.edu/Services/CatalogService.svc/rest';
const COURSE_ENDPOINT =
CATALOG_API + '/courses/all';

let connection;

/*
 * Handle command line arguments
 */
program
.version('2.0.0')
.option('-n --no-save',
  'Don\'t save to a database')
.option('-i --ip [ip]',
  'Host of the RethinkDB server, default "localhost"')
.option('-p --port [port]',
  'Client port of the RethinkDB server, default 28015')
.option('-d --db [db]',
  'The RethinkDB database, default "test"')
.option('-a --auth-key',
  'Authentification key to the RethinkDB server, default ""')
.option('-v --verbose',
  'Print all output to the console')
.parse(process.argv);

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

function insertCoursesInRethink(rawParsedJSON) {
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
  .then(insertCoursesInRethink)
  .done();
}

main();
