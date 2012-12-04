#!/usr/bin/env node

/**
 * Handles the incoming requests, calls the parsing and processing functions, sends response
 */

var async = require('async'),
    bp = require('./lib/batchProcessor'),
    config = require('./config.json'),
    express = require('express'),
    dependencyGraph = require('./lib/dependencyGraph'),
    request = require('request'),
    jsonpath = require('JSONPath').eval,
    logger = require('./lib/logger');

var app = express(),
    log = logger.getLogger(config.logger);

/**
 * Expose configure
 *
 * Standard configuration. 
 * 
 * @return app (configured express object)
 */
exports.configure = function() {

  app.configure(function() {
    app.use(express.compress());
    app.use(express.bodyParser());
  });

  app.configure('development', function() {
    app.use(express.logger({stream:log.winstonStream}));
    app.use(express.errorHandler({
      dumpExceptions: true,
      showStack : true
    }));
  });

  app.configure('production', function() {
    app.use(express.errorHandler({
      dumpExceptions: false,
      showStack: false
    }));
  });
  
  return app;
}

/**
 * Expose processBatchRequest
 * 
 * This function processes a batch request, using a given express instance
 * 
 * @param {Object} batchApp 
 * 
 */
exports.processBatchRequest = function(batchApp) {
  
  batchApp.all('*',
    dependencyGraph.getGraph,
    bp.processBatch,
    sendResponse
  );
}

/**
 * Expose sendResponse
 *
 * This function sends the response of all apiCall objects back to the client, wrapped into one JSON object.
 *
 * @param {Object} req
 * @param {Object} res
 *
 */
exports.sendResponse = sendResponse = function(req, res) {
  var response = [];
  req.body.map(function(apiRequest) {
    if (apiRequest.setNull) {
      response.push(null);
    } else {
      response.push({
        body: apiRequest.bodyResponse,
        headers: apiRequest.headers,
        statusCode: apiRequest.statusCode
      });
    }
  });
  

  res.send(JSON.stringify(response));
}

