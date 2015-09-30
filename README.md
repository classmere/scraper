# scraper [![Build Status](https://travis-ci.org/classmere/scraper.svg?branch=master)](https://travis-ci.org/classmere/scraper)

Node.js script scrapes the entire Oregon State course catalog into a [RethinkDB](https://www.rethinkdb.com/) database.

## Usage
Classmere deploys on [Heroku](https://www.heroku.com/home) and follows the standard practice of supplying config data via environment variables. This app looks uses four environment variables to configure the RethinkDB connection:
- `DATABASE_HOST`: IP Address of database (default `127.0.0.1`)
- `DATABASE_PORT`: Port of database (default `28015`)
- `DATABASE_DB`: Name of the database (default `test`)
- `DATABASE_KEY`: RethinkDB key (default `''`)
