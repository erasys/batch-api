#!/usr/bin/env node


/**
* By calling the script, the environment can be specified in the command line:
* NODE_ENV=development node batchApi.js
* OR
* NODE_ENV=production node batchApi.js
* The specified environment determines which of configurations below is used
*/

var batchApi = require('./batchApi.js'),
    config = require('./config.json'),
    request = require('request'),
    logger = require('./lib/logger');
       
var app = batchApi.configure(),
    log = logger.getLogger(config.logger);
    
/**
 * Process any request
 */
app.all('*', function(req, res, next) {
  res.set('Content-Type', 'application/json; charset=utf-8');
  req.headers["HTTP_X_FORWARDED_FOR"] = req.ip;

  request({uri: config.apiServer.url + ":" + config.apiServer.port}, function (error, response, body) {
    if (error) {
      res.send({body: "API not available", statusCode: 503 });
    } else {
      next();
    }
  });
});


/**
 * Process any request on a given route with the batch API 
 */
app.all('*', function(req, res, next) {
  batchApi.processBatchRequest(app);
  next();
});

app.listen(config.apiBatchServer.port);

log.info('Batch Request Api started. Listening on port ' + config.apiBatchServer.port);
