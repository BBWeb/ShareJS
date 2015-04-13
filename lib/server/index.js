var session = require('./session');
var rest = require('./rest');
var useragent = require('./useragent');
var livedb = require('livedb');

if (!require('semver').gte(process.versions.node, '0.10.0')) {
  throw new Error('ShareJS requires node 0.10 or above.');
}

/** This encapsulates the sharejs server state & exposes a few useful methods.
 *
 * @constructor
 */
var ShareInstance = function(options) {
  console.log('ShareInstance ', (+new Date()));
  this.options = options;

  this.preValidate = options.preValidate;
  this.validate = options.validate;

  if (options.backend) {
    this.backend = options.backend;
  } else {
    this.backend = livedb.client(options.db);
  }

  // Map from event name (or '') to a list of middleware.
  this.extensions = {'':[]};
  this.docFilters = [];
  this.opFilters = [];
};

/** A client has connected through the specified stream. Listen for messages */
ShareInstance.prototype.listen = function(stream, req) {
  console.log('ShareInstance.prototype.listen ', (+new Date()));
  session(this, stream, req);
};

// Create and return REST middleware to access the documents
ShareInstance.prototype.rest = function() {
  console.log('ShareInstance.prototype.rest ', (+new Date()));
  return rest(this);
};


/** Add middleware to an action. The action is optional (if not specified, the
 * middleware fires on every action).
 */
ShareInstance.prototype.use = function(action, middleware) {
  console.log('ShareInstance.prototype.use ', (+new Date()));
  if (typeof action !== 'string') {
    middleware = action;
    action = '';
  }

  if (action === 'getOps') {
    throw new Error("The 'getOps' middleware action has been renamed to 'get ops'. Update your code.");
  }

  var extensions = this.extensions[action];
  if (!extensions) extensions = this.extensions[action] = [];

  extensions.push(middleware);
};


/** Add a function to filter all data going to the current client */
ShareInstance.prototype.filter = function(fn) {
  console.log('ShareInstance.filter ', (+new Date()));
  this.docFilters.push(fn);
};

ShareInstance.prototype.filterOps = function(fn) {
  console.log('ShareInstance.filterOps ', (+new Date()));
  this.opFilters.push(fn);
};

ShareInstance.prototype.createAgent = function(stream) {
  console.log('ShareInstance.createAgent ', (+new Date()));
  return useragent(this, stream);
};

// Helper method to actually trigger the extension methods
ShareInstance.prototype._trigger = function(request, callback) {
  console.log('ShareInstance.trigger ', (+new Date()));
  // Copying the triggers we'll fire so they don't get edited while we iterate.
  var middlewares = (this.extensions[request.action] || []).concat(this.extensions['']);

  var next = function() {
    if (!middlewares.length)
      return callback ? callback(null, request) : undefined;

    var middleware = middlewares.shift();
    middleware(request, function(err) {
      if (err) return callback ? callback(err) : undefined;

      next();
    });
  };

  next();
};

exports.createClient = function(options) {
  return new ShareInstance(options);
};

