# scraper [![Build Status](https://travis-ci.org/classmere/scraper.svg?branch=feature%2Forchestrate)](https://travis-ci.org/classmere/scraper)

Node.js script that scrapes the entire Oregon State course catalog into [Orchestrate.io](https://orchestrate.io).

## Usage
`$ npm start `

This script requires a config.js containing a valid Orchestrate API key and server URL.
##### Example:
```javascript
exports.token = 'orchestrate-api-token';
exports.server = 'https://api.aws-us-east-1.orchestrate.io/';
```
