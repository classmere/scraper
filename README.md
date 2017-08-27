# scraper [![Build Status](https://travis-ci.org/classmere/scraper.svg?branch=master)](https://travis-ci.org/classmere/scraper)

Node.js script scrapes the entire Oregon State course catalog into a 
[MongoDB](https://www.mongodb.com/) database.

## Scraping into MongoDB
The scraper has two options for outputting class data. The first and default 
option is to output data to a MongoDB database. This is accomplished by running 
the following line:

```bash
yarn run start
```

The MongoDB instance this scrapes into can be modified with the `MONGO_URL` 
environment variable (default is `mongodb://localhost:27017/test`)

## Scraping to command line or piping to other programs
Alternatively, the scraper can output course data straight to the command line.
This is accomplished by appending the `--console` flag when calling the program like so:

```bash
yarn run start -- --console
```