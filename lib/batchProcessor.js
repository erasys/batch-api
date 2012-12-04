var dependencyGraph = require('./dependencyGraph.js'),
    config = require('../config.json'),
    logger = require('./logger'),
    request = require('request'),
    async = require('async'),
    jsonpath = require('JSONPath').eval;

var log = logger.getLogger(config.logger),
    serverUrl = config.apiServer.url + ":" + config.apiServer.port + "/";

/**
* Runs through the apiCall graph that contains all dependencies and returns its heads (i.e. nodes without children)
*
* @param {dependencyGraph} graph
*
* @return {Array} heads
*/
function getHeads(graph) {
  var heads = [];
  Object.keys(graph).forEach(function(key) {
    if (graph[key].dps.length == 0) {
      heads.push(key);
    }
  });
  return heads;
}


/**
 * parallelizeBatch is the heart of the batchProcessing.
 * Recursively runs through the apiCall graph; children of a parent (set) are processed in parallel.
 * Parents and their children are called in series.
 *
 * @param {Array} set
 * @param {Function} callback
 *
 * @return  void
 */
function parallelizeBatch(names, req, callback) {

  async.map(names, function(apiRequestName, callback) {
    apiCall(
      dependencyGraph.getApiRequest(req.body, apiRequestName),
      req,
      function() {
        var children = req.graph[apiRequestName].refs;
        if (!children) callback();
        parallelizeBatch(children, req, callback);
      });
  }, callback);
}

/**
 * apiCall makes a apiRequest with the URL stored in the relative_url field of the apiRequest of the batch.
 * The response is stored in that apiRequest, next to the other information method of calling (GET/POST/..), name, relative_url etc.
 *
 * @param   {Object} apiRequest
 * @param   {Function} callback
 *
 */
function apiCall(apiRequest, req, callback) {
  // if the pattern is found in the string after parsing, it means this pattern could not be replaced by the result of another parent yet.
  // Next time when this is called by the other parent, it will be checked again
  if (!dependencyGraph.isApiRequestProcessed(dependencyGraph.parseApiRequest(req.body, apiRequest))) {
    //apiRequest not ready yet
    callback();
  } else {
    //apiRequest has all information. Start request..

    // HEADER Fixes
    req.headers.host = config.apiServer.host; // Fix Headers host
    delete req.headers['content-length']; // Fix GET slow down
    delete req.headers['accept-encoding']; //fix double compression
    if (apiRequest.method.toString() == 'POST' || apiRequest.method.toString() == 'PUT') {
      req.headers['content-type'] = 'application/x-www-form-urlencoded'; // Fix Post body request
    }
    if (!apiRequest.body) apiRequest.body = '';

    request({
        headers: req.headers,
        method: apiRequest.method.toString(),
        body: apiRequest.body.toString(),
        uri: serverUrl + apiRequest["relative_url"].toString(),
        timeout: config.timeout
      },
      function (error, response, body) {
        if (!response) {
            log.error("Api host sent no response. Error:" + error.code);
            apiRequest.bodyResponse = error.code;
            apiRequest.statusCode = 500;
            apiRequest.setNull = true;
        } else {
          if (error) {
            log.error(apiRequest.name + " Response: " + body);
            log.error("Error: " + error + " status code: " + response.statusCode);
          }
          try {
            apiRequest.bodyResponse = JSON.parse(body);
          } catch (err) {
            apiRequest.bodyResponse = "Response was no JSON object";
            log.error(body);
          }
          apiRequest.headers = response.headers;
          apiRequest.statusCode = response.statusCode;
        }
        callback();
      }
    );
  }
}

/**
 * Expose processBatch(req, res, next)
 */
exports.processBatch = function(req, res, next) {
  var done = [],
      heads = getHeads(req.graph);

  async.forEach(heads,  function(head, callback) {
    parallelizeBatch([head], req, function(err, result) {
      done.push(result);
      if (done.length == heads.length ) next();
    });
    callback();
  });
}






