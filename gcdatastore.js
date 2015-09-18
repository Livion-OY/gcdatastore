"use strict";

//var fs = require('fs');
var path = require('path');
var Q = require('q');
var extend = require('extend');

var debugPerf = require('debug')('datastore:performance');
var isDebugPerf = process.env.DEBUG && (process.env.DEBUG.indexOf('datastore:*') > -1 || process.env.DEBUG.indexOf('datastore:performance') > -1);

if (!process.env.GC_PROJECTID) throw new Error('GC_PROJECTID env variable is required')
var auth = {
  projectId: process.env.GC_PROJECTID
}

if (process.env.GC_FILEPATH) {
  auth.keyFilename = process.env.GC_FILEPATH
}

// auth to gcloud globally
var gcloud = require('gcloud')(auth);

var _dataset;

//┌——————————————————————————————————————————————————┐
//│ ↓ Helper functions                             ↓ │
//└——————————————————————————————————————————————————┘
var perf = function() {
  if (!isDebugPerf) {
    return {diff:function() {}};
  }
  var self = this;
  this.time = process.hrtime();
  this.diff = function() {
    var diff = process.hrtime(self.time);
    return ((diff[0] * 1e9 + diff[1]) / 1000000).toFixed(2)
  }
}

function genQuery(q, collection, query) {
  for (var k1 in query) {
    var obj = query[k1]
    if (typeof obj === 'object') {
      for (var k2 in obj) {
        switch (k2) {
          case '$gt':
            q = q.filter(k1 + ' >', obj[k2])
            break;
          case '$gte':
            q = q.filter(k1 + ' >=', obj[k2])
            break;
          case '$lt':
            q = q.filter(k1 + ' <', obj[k2])
            break;
          case '$lte':
            q = q.filter(k1 + ' <=', obj[k2])
            break;
          default:
            throw new Error('invalid query property', k2)
        }
      }
    } else if (Array.isArray(obj)) {
      throw new Error('array is not supported in query')
    } else if (k1 === '_id') {
      q = q.filter('__key__ =', _dataset.key([collection, obj.toString()]))
    } else {
      q = q.filter(k1 + ' =', obj)
    }
  }
  return q;
}

function genFilter(filter) {
  var arr = []
  for (var key in filter) {
    if (filter[key]) arr.push(key);
  }
}

function genSort(q, sort) {
  for (var key in sort) {
    if (sort[key] > 0) q = q.order(key);
    else  q = q.order('-' + key);
  }
}

function parseRes(entities) {
  return entities.map(function(entity) {
    if (entity.key.path[1]) {
      return extend(entity.data, {_id: entity.key.path[1]});
    }
    throw new Error('path does not have id')
  })
}

//┌——————————————————————————————————————————————————┐
//│ ↓ API                                          ↓ │
//└——————————————————————————————————————————————————┘
var GCD = function(namespace) {
  if (namespace) {
    _dataset = gcloud.datastore.dataset({namespace: namespace});
  } else {
    _dataset = gcloud.datastore.dataset();
  }
};

GCD.prototype.collection = function(coll) {
  this._c = coll
  return this;
}

GCD.prototype.get = function(query, filter, params) {
  return Q.Promise(function(resolve, reject) {
    if (!this._c) throw new Error('collection is required')
    var pf = new perf();
    var selectArr = genFilter(filter);
    var q = _dataset.createQuery(this._c)
      .select(selectArr)

    q = genQuery(q, this._c, query);

    if (params) {
      if (params.limit) q = q.limit(parseInt(params.limit, 10))
      if (params.skip) q = q.offset(parseInt(params.skip, 10));
      if (params.sort) genSort(params.sort);
    }

    _dataset.runQuery(q, function(err, entities) {
      debugPerf('GCD.get request took ' + pf.diff() + ' milliseconds');
      if (err) return reject(err);
      resolve(parseRes(entities));
    });
  }.bind(this))
}

GCD.prototype.getOne = function(id, filter) {
  return Q.Promise(function(resolve, reject) {
    if (!this._c) throw new Error('collection is required')
    if (!id) throw new Error('id is required')
    var pf = new perf();
    var selectArr = genFilter(filter);
    var q = _dataset.createQuery(this._c)
      .filter('__key__ =', _dataset.key([this._c, id.toString()]))
      .select(selectArr)
      .limit(1)
    _dataset.runQuery(q, function(err, entities) {
      debugPerf('GCD.getOne request took ' + pf.diff() + ' milliseconds');
      if (err) return reject(err);
      var res = parseRes(entities)
      resolve(res && res[0]);
    });
  }.bind(this))
}

GCD.prototype.save = function(data) {
  return Q.Promise(function(resolve, reject) {
    if (!this._c) throw new Error('collection is required')
    if (!data) throw new Error('data is required')
    var pf = new perf();
    var keyArr = [this._c]
    if (data._id) {
      keyArr.push(data._id.toString())
      delete data._id;
    }
    var key = _dataset.key(keyArr);
    _dataset.save({
      key: key,
      data: data
    }, function(err) {
      debugPerf('GCD.save request took ' + pf.diff() + ' milliseconds');
      if (err) return reject(err);
      resolve()
    });
  }.bind(this))
}

GCD.prototype.delete = function(id) {
  return Q.Promise(function(resolve, reject) {
    if (!this._c) throw new Error('collection is required')
    if (!id) throw new Error('id is required')
    var pf = new perf();
    _dataset.delete(_dataset.key([this._c, id]), function(err, res) {
      debugPerf('GCD.delete request took ' + pf.diff() + ' milliseconds');
      if (err) return reject(err);
      resolve(res)
    });
  }.bind(this))
}

module.exports = GCD;
