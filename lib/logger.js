/**
 * multi-transport async logging
 * see https://github.com/flatiron/winston
 */

var winston = require('winston');

var getLogger = exports.getLogger = function(options) {
  transports = [];
  if (options && options.console) transports.push(new (winston.transports.Console)(options.console));
  if (options && options.file)    transports.push(new (winston.transports.File)(options.file));
  return new (winston.Logger)({ transports: transports });
}

// enable web server logging; pipe those log messages through winston
var winstonStream = exports.winstonStream = {
  write: function(message, encoding) {
    winston.info(message);
  }
};
