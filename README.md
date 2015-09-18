# Promisified Mongodb style api for [gcloud-node datastore](https://github.com/GoogleCloudPlatform/gcloud-node#google-cloud-datastore)

- uses [Q](https://github.com/kriskowal/q) for promises
- supports mongodb style **query**, **filter**, **sort**, **limit**, **skip**

# API

- collection
- get
- getOne
- save
- delete

# Example

```
// define projectid and keypath
// note that keypath is optional if you are working inside google compute engine and 
process.env.GC_PROJECTID = 'gc-project-id'
process.env.GC_KEYPATH = path.join('path/to/gc-key.json')
var GCD = require('gcdatastore')
var namespace = 'example'
var gcd = new GCD(namespace)

var coll = gcd.collection('samples')
var data;

// save object to gcd 
coll.save({test: 'data', one: 'one', date: new Date()}).then(function(res) {
  console.log('save ok')
}).catch(function(err) {
  console.log('save failed', err)
})

// get list, where test='data', result contains list of {_id: 123456, one:'one'}} and is sorted by date, 0 is skipped and count is limited to 1.   
coll.get({test: 'data'}, {one:1}, {limit:1, skip:0, sort:{date:1}}).then(function(res) {
  console.log(res)
  data = res[0]
})

// delete data by _id
coll.delete(data._id).then(function(res) {
  console.log(res)
})

```