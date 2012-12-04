# Batch API Proxy

API proxy to bundle a batch of calls in one request.

The requested API calls may have dependencies on responses of earlier calls specified by a JSONPath expression and are processed in parallel, when possible, in sequence when necessary.

Using a batch API reduces HTTP overhead, network round-trip delay time and helps to keep your API design clean.


## Features

  * Server side parallel request processing 
  * Request dependencys (using [JSONPath](https://github.com/s3u/JSONPath))
  * Client IP forwarding (`HTTP_X_FORWARDED_FOR`)


## Getting Started

Install [Node 0.8.X](http://nodejs.org/#download) then get the source and install the dependencies:

```console
$ git clone https://github.com/erasys/batch-api
$ cd batch-api
\# npm install
```

To start the [Express](http://expressjs.com) based server you just need edit host/url/port in `config.json` to match your setup (see "Configuration and Setup" section below) and `npm start`.



# Configuration and Setup

## Hosts and ports

A config file is provided to setup the batch API to your environment. 
First, you can specify URL and port for your API where all API calls within a batch are handled and second, the URL and port where the requests to your batch API are 
processed.

## Setting up a batch API server

The configure method creates an Express instance and makes a setup for error handling and default parameters. 
Note that you will need to use Express' bodyParser/JSON if you choose to use an own configuration. You might also need 
to use `compress()`.

```js
var batchApi = require('./batchApi.js');
var app = batchApi.configure();
```

Set the route you want to use for processing your batch API requests, and then call `processBatchRequest`.
Make sure the response's content-type is set to JSON.

```js
app.all('*', function(req, res, next) {
  res.set('Content-Type', 'application/json; charset=utf-8');
  batchApi.processBatchRequest(app);
  next();
});
```

Finally, make your server listens to the port you specified in the config file.

```js
app.listen(require('./config.json').apiBatchServer.port);
```

Now you have installed the server infrastructure and can go on with client-side usage of the batch API.


# API calls

In the simplest case, we only have one request (API call) in the request batch. 
We use the POST method to pass the batch to the server, and the batch object is an array containing the API call objects.

Any API call object within the batch contains following attributes:

* `method` – possible values are `GET` or `POST` or whatever methods the called API supports  
* `name` – optional, but if another API call needs the response of this call, its name is used as reference. Names must be UNIQUE!
* `relative_url` – the relative URL that calls the API function. Possible GET parameters are also given here  
* `body` – the parameters that the API function uses when the method is POST are given here  


An example of a batch call might thus look like:

```sh
curl -v -H "Accept: application/json" -H "Content-type: application/json" -X POST -d '[ \  
{ \
  "method":"POST", \  
  "name":"loginMyUser",  \  
  "relative_url":"/login", \  
  "body":"username=myuser&password=mypass&key=1234" \  
} \  
]' http://yourserverurl:port
```

In the response of the batch API server the order of the API calls will be preserved (we only have one in this example). 
The responses of the API calls are in the body of the response of the batch API server.
It is a JSON string describing an array of response objects. Each response object contains following attributes:

* `body` – the response of an API call
* `headers` – the header of an API call
* `statusCode` – the status code of an API call

The example above might result in a structure like this: 

```json
[  
 {  
   "body": {"sessionId": "SESS123" },
   "headers": {
                "date":"Fri, 21 Dec 2012 11:11:11 GMT","server":"Apache","expires":"Fri, 21 Dec 2012 12:12:12 GMT",
                "cache-control":"no-store, no-cache, must-revalidate, post-check=0, pre-check=0",
                "pragma":"no-cache",
                "content-length":"102",
                "connection":"close",
                "content-type":"application/json; charset=utf-8"
              },
   "statusCode":200
  }
]
```


## Multiple API calls

Making multiple API calls are very similar to making a single API call. The batch just contains more than one API call object:

```sh
curl -v -H "Accept: application/json" -H "Content-type: application/json" -X POST -d '[ \  
  { \  
    "method":"POST", \  
    "name":"loginMyUser",  \  
    "relative_url":"/login", \  
    "body":"username=myuser&password=mypass&key=1234" \  
  }, \
    "method":"POST", \
    "name":"getLoggedInUsers",  \  
    "relative_url":"/getUsers", \  
    "body":"status=loggedin" \  
  }, \  
]' http://yourserverurl:port  
```

As mentioned above, the response of the batch API server will preserve the order of the API calls. 
So the response array holds in its first position the response of the API call object first in the API batch array, and in its second position the response of the API call object at the second position of the batch array, and so on.

Calls that do not depend on each other are run in parallel. 
When all calls of the batch have finished, the response is sent.

A body of the response might then look like this:

```json
[  
  {  
    "body": { "sessionId": "SESS123" }  
    "headers": {  
                "date":"Fri, 21 Dec 2012 11:11:11 GMT","server":"Apache","expires":"Fri, 21 Dec 2012 12:12:12 GMT",  
                "cache-control":"no-store, no-cache, must-revalidate, post-check=0, pre-check=0",  
                "pragma":"no-cache",  
                "content-length":"102",  
                "connection":"close",  
                "content-type":"application/json; charset=utf-8"   
              },  
    "statusCode":200  
  },  
  {  
    "body": {"userId": [123, 232, 666, 898, 994] }  
    "headers": {  
                "date":"Fri, 21 Dec 2012 11:11:11 GMT","server":"Apache","expires":"Fri, 21 Dec 2012 12:12:12 GMT",  
                "cache-control":"no-store, no-cache, must-revalidate, post-check=0, pre-check=0",  
                "pragma":"no-cache",  
                "content-length":"102",  
                "connection":"close",  
                "content-type":"application/json; charset=utf-8"  
              },  
    "statusCode":200  
  }  
]  
```

## Dependent calls

A useful application of a batched API call is the usage of results of one API call within the call parameters of another.
An example might be a session key that you request by logging in and using it for an API call where a session key is a mandatory parameter.
Of course, these calls are then handled in sequence.
You do not have to specify directly whether an API call depends on another API call, you do it implicitly by referring to its name in the parameters of the API call:

```sh
curl -v -H "Accept: application/json" -H "Content-type: application/json" -X POST -d '[ \  
  { \  
    "method":"POST", \  
    "name":"loginMyUser",  \  
    "relative_url":"/login", \  
    "body":"username=myuser&password=mypass&key=1234" \  
  }, \  
  {  
    "method":"POST", \  
    "name":"getNewMessages",  \  
    "relative_url":"/getMessages", \  
    "body":"sessionId={result=loginMyUser:$.sessionId}&type=new" \  
  }, \  
]' http://yourserverurl:port  
```

Note the JSONPath expression within the body of the API `getNewMessages` call. 
The parameter `sessionId` refers to a result of the `loginMyUser` API call which is unknown at the point of time the batch request is sent. 
With JSONPath expressions you are able to use the JSON output of one request as a parameter for a dependent call:

__{result=__`<request name>`:$.`<response item>`__}__

__Request name__ specifies the response of which API call we are using. __Response item__ is a name within the JSON response of this call.

Feel free to use more complex [JSONPath](https://github.com/s3u/JSONPath) expressions like `{result=users:$.items[0].id}`.

# Error handling

If one of your requested operations returns a HTTP error this will be encapsulated in the JSON response object. 
Dependent calls will have the reponse value `null`.

Requests that timeout and their dependent requests also return the response value `null`.

The same will happen if you use a JSONPath expression that has no match.


# Dependencies

* [Async](https://github.com/caolan/async) – Higher-order functions and common patterns for asynchronous code
* [dependency-foo](https://github.com/firebaseco/dependency-foo) – Serializable General Purpose Dependency Graph
* [Express](http://expressjs.com) – Router, view rentering, configruation
* [JSONPath](https://github.com/s3u/JSONPath) – A JS implementation of JSONPath
* [mocha](http://visionmedia.github.com/mocha/) – simple, flexible, fun test framework
* [omf](https://github.com/brianc/node-omf) – ORANGE MOCHA FRAPPUCCINO
* [qs](https://github.com/visionmedia/node-querystring) – querystring parser
* [request](https://github.com/mikeal/request) – Simplified HTTP request client


# The usual

We are [hiring](http://www.erasys.de/public/front_content.php?idcat=9)!
