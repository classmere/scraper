const scraper = require('./src/scraper');

// const Readable = require('stream').Readable;
// const rs = Readable({ objectMode: true });
const Writable = require('stream').Writable;
const ws = new Writable({ objectMode: true });

ws._write = function (chunk, enc, next) {
  console.log(chunk);
  next();
};

const courseStream = scraper.startScrapeStream().pipe(ws);