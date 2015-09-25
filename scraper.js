const program       = require('commander');
const courseJSONFetcher   = require('./rawCourseJSONFetcher');

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

// dataFormatter();
courseJSONFetcher();
