String.prototype.stripNonAlphanumeric = function() {
  return this.replace(/[^0-9a-z]/gi, '');
};

String.prototype.stripNewlines = function() {
  return this.replace(/\r?\n|\r/g, '');
};

String.prototype.stripExcessSpaces = function() {
  return this.replace(/\s+/g,' ').trim();
};

module.exports = String;