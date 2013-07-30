var Stream = require('stream'),
    through = require('through'),
    unique = require('unique-stream'),
    subindex = require('subindex');

module.exports = queryengine;
function queryengine(db) {
  if (!db.query) {
    db.query = query.bind(db);
    db.query.use = use.bind(db);
  }

  return subindex(db);
}

function query() {
  var q = [].slice.call(arguments);
  var candidates;
  var db = this;
  var stats = { indexHits: 0, dataHits: 0, matchHits: 0 };
  var indexStream = db.query.engine.query.apply(db, q);
  if (indexStream !== null && indexStream instanceof Stream) {
    indexStream.on('data', function (data) {
      stats.indexHits++;
    });
    candidates = indexStream
      .pipe(unique(keyfn))
      .pipe(createValueStream.call(db))
      .on('data', function (data) {
        stats.dataHits++;
      });
  } else {
    // table scan
    candidates = db.createReadStream().pipe(through(function (data) {
      stats.dataHits++;
      if (data.value !== undefined) this.queue(data.value);
    }));
  }
  var values = candidates.pipe(through(
    function write(data) {
      if (db.query.engine.match.apply(db, q.concat(data))) {
        stats.matchHits++;
        this.queue(data);
      }
    },
    function end() {
      values.emit('stats', stats);
      this.queue(null);
    }));
  return values;
}

function use(queryEngine) {
  var db = this;
  db.query.engine = queryEngine;
}

function keyfn(index) {
  return index.key[index.key.length - 1];
}

function createValueStream() {
  var db = this;
  var s = new Stream();
  s.readable = true;
  s.writable = true;

  var work = 0;
  var ended = false;

  s.write = function (data) {
    work++;
    db.get(keyfn(data), function (err, value) {
      if (!err) s.emit('data', value);
      if (--work === 0 && ended) s.end();
    });
  };

  s.end = function (data) {
    ended = true;
    if (arguments.length) s.write(data);
    if (work === 0 && s.writable) {
      s.writable = false;
      s.emit('end');
    }
  };

  s.destroy = function () {
    s.writable = false;
  };

  return s;
}
