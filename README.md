# scraper [![Build Status](https://travis-ci.org/classmere/scraper.svg?branch=feature%2Forchestrate)](https://travis-ci.org/classmere/scraper)

Node.js script that scrapes the entire Oregon State course catalog.

## Usage
```$ npm start ```

This script is intended for use within a Docker container linked to a MongoDB container. If you want to use it in another situation however, just type your Mongo server's address into `mongoose.connect()` on line 16.
