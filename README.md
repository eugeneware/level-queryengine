# level-queryengine

A generic pluggable query-engine system (that supports indexes) for levelup/leveldb databases.

Using this architecture you can query your levelup database using your own query langauge with **full index support**.

## Query languages currently supported

Here is a list of the query plugins that are currently written and work with
`level-queryengine`:

* [jsonquery-engine](https://github.com/eugeneware/jsonquery-engine) -
  [MongoDB query language](http://docs.mongodb.org/manual/reference/operator/)
  implemented for levelup **WITH** indexing!
* [fulltext-engine](https://github.com/eugeneware/fulltext-engine) - Query your
  levelup/leveldb engine using full text search phrases with full text indexing.
* [path-engine](https://github.com/eugeneware/path-engine) - Simple javascript
  object "path" syntax query langauge implemented for levelup **WITH** indexing.

Write YOUR own query language plugins to run on top of levelup, and get the full
benefit if indexing for highly-performant lookups!

## Why is this needed?

Because while it is relatively easy to programatically write your own stream
filters to query levelup, making efficient use of indexes (particularly when
multiple indexes may be available) is painful.

This module allows you to write your own index implementations and query
languages and have the query engines work out what the best indexes are to use.

Query languages will generally have a declarative syntax that specifies what
fields are to be retrieved, and this can be used to identify indexes, and then
most efficiently retrieve your data.

## Installation

Install via npm:

```
$ npm install level-queryengine
```

## Usage

Example Usage with the [jsonquery-engine](https://github.com/eugeneware/jsonquery-engine):

``` js
var levelQuery = require('level-queryengine'),
    jsonqueryEngine = require('jsonquery-engine'),
    pairs = require('pairs'),
    levelup = require('levelup'),
    db = levelQuery(levelup('my-db'));

db.query.use(jsonqueryEngine());

// index all the properties in pairs
db.ensureIndex('*', 'pairs', pairs.index);

// alternatively you could just index the properties you want:
// db.ensureIndex('num');
// db.ensureIndex('tags');

db.batch(makeSomeData(), function (err) {
  // compound mongodb / jsonquery query syntax
  db.query({ $and: [ { tags: 'tag1' }, { num: { $lt: 100 } } ] })
    .on('data', console.log)
    .on('stats', function (stats) {
      // stats contains the query statistics in the format
      //  { indexHits: 1, dataHits: 1, matchHits: 1 });
    });
});
```

Example Usage with the [fulltext-engine](https://github.com/eugeneware/fulltext-engine):

``` js
var levelQuery = require('level-queryengine'),
    fulltextEngine = require('fulltext-engine'),
    levelup = require('levelup'),
    db = levelQuery(levelup('my-db'));

db.query.use(fulltextEngine());

// index the properties you want (the 'doc' property on objects in this case):
db.ensureIndex('doc', 'fulltext', fulltextEngine.index());

db.batch(makeSomeData(), function (err) {
  // will find all objects where 'my' and 'query' are present
  db.query('doc', 'my query')
    .on('data', console.log)
    .on('stats', function (stats) {
      // stats contains the query statistics in the format
      //  { indexHits: 1, dataHits: 1, matchHits: 1 });
    });

  // will find all objects where 'my' OR 'query' are present
  db.query('doc', 'my query', 'or')
    .on('data', console.log)
    .on('stats', function (stats) {
      // stats contains the query statistics in the format
      //  { indexHits: 1, dataHits: 1, matchHits: 1 });
    });
});
```

Example Usage with the [path-engine](https://github.com/eugeneware/path-engine):

``` js
var levelQuery = require('level-queryengine'),
    pathEngine = require('path-engine'),
    levelup = require('levelup'),
    db = levelQuery(levelup('my-db'));

db.query.use(pathEngine());

// index the properties you want:
db.ensureIndex('num');

db.batch(makeSomeData(), function (err) {
  // will find all objects with the num field set to 42
  db.query(['num', 42])
    .on('data', console.log)
    .on('stats', function (stats) {
      // stats contains the query statistics in the format
      //  { indexHits: 1, dataHits: 1, matchHits: 1 });
    });
});
```

## API

### require('level-queryengine')

Returns a function which you call on your levelup instance to add query and
indexing capabilities. Eg:

``` js
var levelQuery = require('level-queryengine'),
    levelup = require('levelup'),
    db = levelQuery(levelup('my-db'));
```

### db.query.use(queryEngine)

Sets the query engine to use for subsequent `#query` calls.

A `queryEngine` plugin is simply an object that returns the following functions:

``` js
// example
{
  query: query,
  match: matchfn,
  plans: {
    'property': propertyPlanFn,
    'pairs': pairsPlanFn
  }
};
```

* `query` (function) - will be called by `db#query`, to execute the query. It
  must return an index stream (of indexes - see [subindex](https://github.com/eugeneware/subindex))
  if indexes can be used OR `null` if no indexes can be used and a full levelup
  database "table" scan will commence instead.
* `match(objectToMatch, query)` (function) - a function that will be used
  as a final filter on the object stream generated. This function must return
  `true` if the `objectToMatch` matches the `query` passed to it.
  If an index creates some false positives then this function is responsible
  for doing the FINAL filter to ensure that `objectToMatch` matches the query.
  This is also used in the event of table scan to do the bulk of the filtering.
* `plans` - a map of index strategy types to "plan" functions which take a
  subquery of the query execution, and return an indexStream if indexes can be
  used for the subquery, or `null` if no index can be used (which will cause a
  full levelup database "table" scan. Plan functions are used to divide
  responsibility between generating complicated compound queries (which may need
  to AND or OR the resultantant stream of index keys), to a simple subquery
  which works out what indexes to use. See the implementations of
  [jsonquery-engine](https://github.com/eugeneware/jsonquery-engine) and
  [path-engine](https://github.com/eugeneware/path-engine) for more details. By
  exposing the internals of the query plans it allows for people to write their
  own implementations of the query engines to run over other indexing strategies.

### db.query(query)

Executes `query` using the current query engine, and returns a stream of values.

## TODO

This project is under active development. Here's a list of things I'm planning to add:

* add time taken to the statistics reporting
* make the `indexHits` reporting more accurate for compound queries that depend on ANDs and ORs of streams.
* allow for multiple query engines to be used at the same time
* Do a SQL based query engine reference implementation (just for kicks!).
* Add joins to some of the reference implementations.
