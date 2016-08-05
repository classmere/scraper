Number.prototype.isEven = function() {
  return this % 2 == 0;
};

Number.prototype.isOdd = function() {
  return Math.abs(this % 2) == 1;
};

module.exports = Number;