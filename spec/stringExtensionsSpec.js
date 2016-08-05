const String = require('../src/stringExtensions');

describe('stringExtensions', function() {

  it("removes non alphabetic characters with stripNonAlphanumeric()", function() {
    const nonAlphaString = '98&!!@#$%^&*(()_$^&A(&**&^%B$#())C';
    expect(nonAlphaString.stripNonAlphanumeric()).toEqual('98ABC');
  });
});