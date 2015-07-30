# scraper [![Build Status](https://travis-ci.org/classmere/scraper.svg?branch=feature%2Forchestrate)](https://travis-ci.org/classmere/scraper)

Node.js script scrapes the entire Oregon State course catalog into a Mongo database.

## Usage
Classmere deploys on [Heroku](https://www.heroku.com/home), and we follow the standard practice of supplying config data via environment variables. This app looks for the `MONGO_URL` variable to know which database to connect to. If you don't want to supply your database URL using environment variables, you can supply it via a command line argument:
```shell
npm run mongodb://<dbuser>:<dbpassword>@<dburl>:<dbport>/<dbname>
```
