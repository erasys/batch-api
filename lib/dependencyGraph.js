
//refactor apiRequest to apiRequest

/*
 * functions to parse batch API call, API call requests etc
 */

var async           = require('async'),
    config          = require('../config.json'),
    jsonpath        = require('JSONPath').eval,
    logger          = require('./logger'),
    dependencyFoo   = require('dependency-foo');

var log = logger.getLogger(config.logger);

/**
 *  createGraph runs through the batch of the request and scans for dependencies between the api calls (parents and children),
 *  returning a directed acyclic graph (DAG).
 *
 *  @param  {Array}   batch
 *
 *  @return {Object}  graph.state (an object to represent a DAG)
 */
function createGraph(batch) {
  var graph = new dependencyFoo(),
      regExp = /{result=(.*?):(.*?)}/g,
      requestString,
      match,
      cnt = 0;

  async.forEach(batch, function (apiRequest, callback) {
    if (!apiRequest.name || apiRequest.name == '') {
      apiRequest.name = "id" + cnt;
      cnt++;
    }

    graph.subject(apiRequest.name);

    requestString = apiRequest["relative_url"] + apiRequest.body;

    while (match = regExp.exec(requestString)) {
      for (var apiReq in batch) {
        if (batch[apiReq].name == match[1]) {
            graph.subject(apiRequest.name).dependOn(match[1]);
            break;
        }
      }
    }

    callback();
  })
  return graph.state;
}

/**
 * Expose `getApiRequest(batch. apiRequestName)`.
 *
 *  This function runs through the batch of ApiRequests (containing ApiCall JSON objects with keys method, name, relative_url, body)
 *  and finds the one with the specified name
 *
 *  @param  {Array} batch
 *  @param  {String} apiRequest
 *
 *  @return {Object} apiRequest
 */
exports.getApiRequest = getApiRequest = function(batch, apiRequestName) {
  for (var apiRequest in batch) {
    if (batch[apiRequest].name == apiRequestName) {
      return batch[apiRequest];
    }
  }
  return [];
}


/**
 * Expose `isApiRequestProcessed(apiRequest)`.
 *
 *  This function checks the request strings of an apiRequest object for remaining placeholders that have to be
 *  replaced by the result of the referenced apiCall.
 *
 *  @param  {Object} apiRequest
 *
 *  @return {bool}  true, if there are no placeholders left because all results are there
 *                  false, if there are still results missing
 */
exports.isApiRequestProcessed = function(apiRequest) {
  var regExp = /{result=(.*?):(.*?)}/g;
  if (regExp.test(apiRequest.body+apiRequest["relative_url"])) {
    return false;
  } else {
    return true;
  }
}


/**
 * Expose `parseApiRequest()`.
 *
 *  This function replaces placeholders within the request strings of an ApiCall object.
 *  It checks in the batch of apiCall objects, if the necessary response has been retrieved already and replaces the placeholder with
 *  the response of the process this apiRequest depends on.
 *
 *  @param  {Array} batch
 *  @param  {Object} apiRequest
 *
 *  @return {Object} apiRequest
 */
exports.parseApiRequest = function(batch, apiRequest) {
  var reqStrings = {},
      match,
      regExp = /{result=(.*?):(.*?)}/g;

  if(apiRequest.body && apiRequest.body.length > 0) reqStrings["body"] = apiRequest.body.toString();
  if(apiRequest["relative_url"]) reqStrings["relative_url"] = apiRequest["relative_url"].toString();

  Object.keys(reqStrings).forEach( function(key) {
    while (match = regExp.exec(reqStrings[key])) {
      var apiResult = '';
      var apiRequestParent = this.getApiRequest(batch, match[1]);
      if (apiRequestParent.bodyResponse) { 
        apiResult = apiRequestParent.bodyResponse;
        var jpresult = jsonpath(apiResult, match[2]);
        if ((apiRequestParent.statusCode != 200) || (jpresult.length == 0)) {         
          apiRequest.setNull = true;
          apiRequest.bodyResponse = 'error';
          return apiRequest;
        } else {
          apiRequest[key] = apiRequest[key].toString().replace("{result="+match[1]+":"+ match[2] +"}", jpresult[0]);
        }
      }
    }
  })

  return apiRequest;
}

/**
 * Expose `getGraph(req, res, next)`.
 */
exports.getGraph = function(req, res, next) {
  req.graph = createGraph(req.body);
  return next();

}

