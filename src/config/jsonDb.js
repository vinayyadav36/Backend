/**
 * JSON File Database Engine
 * A complete MongoDB/Mongoose-compatible database adapter using JSON files.
 * Enabled via USE_JSON_DB=true in environment.
 * @version 1.0.0
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Paths ────────────────────────────────────────────────────────────────────
const DATA_DIR   = path.resolve(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Generate a 24-hex-char ObjectId-compatible string. */
function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function getFilePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

/** Load the entire collection array from disk. Returns [] on any error. */
function loadCollection(collection) {
  ensureDir(DATA_DIR);
  const fp = getFilePath(collection);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8')) || [];
  } catch (_e) {
    return [];
  }
}

/**
 * Atomically write collection to disk.
 * Writes to a PID-namespaced temp file then renames it to prevent torn writes.
 */
function saveCollection(collection, data) {
  ensureDir(DATA_DIR);
  const fp   = getFilePath(collection);
  const tmp  = `${fp}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, fp);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) { /* best-effort cleanup */ }
    throw err;
  }
}

// ─── In-memory write-queue (one per collection) ───────────────────────────────
// Node.js is single-threaded but async operations can interleave.
// We serialise writes per collection using a Promise chain.
const writeQueues = Object.create(null); // collection → Promise tail

function enqueueWrite(collection, fn) {
  const prev = writeQueues[collection] || Promise.resolve();
  const next = prev.then(fn).catch(() => fn()); // retry on failure
  writeQueues[collection] = next.catch(() => {}); // don't poison queue
  return next;
}

// ─── Auto-backup every 30 minutes ────────────────────────────────────────────
function doBackup() {
  try {
    ensureDir(BACKUP_DIR);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_DIR, ts);
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.copyFileSync(path.join(DATA_DIR, file), path.join(dest, file));
    }
  } catch (_e) { /* non-fatal */ }
}
const _backupTimer = setInterval(doBackup, 30 * 60 * 1000);
if (_backupTimer.unref) _backupTimer.unref(); // don't keep process alive

// ─── Query engine ────────────────────────────────────────────────────────────

/** Read a value via dot-notation path. */
function getPath(obj, dotPath) {
  if (!dotPath.includes('.')) return obj == null ? undefined : obj[dotPath];
  const parts = dotPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Write a value via dot-notation path, creating intermediate objects. */
function setPath(obj, dotPath, value) {
  if (!dotPath.includes('.')) { obj[dotPath] = value; return; }
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Loose equality that handles ObjectId ↔ string comparisons. */
function looseEq(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b; // eslint-disable-line eqeqeq
  return String(a) === String(b);
}

function evalOperator(docVal, op, operand) {
  switch (op) {
    case '$eq':  return looseEq(docVal, operand);
    case '$ne':  return !looseEq(docVal, operand);
    case '$gt':  return docVal >  operand;
    case '$gte': return docVal >= operand;
    case '$lt':  return docVal <  operand;
    case '$lte': return docVal <= operand;
    case '$in':  return Array.isArray(operand) && operand.some(v => looseEq(docVal, v));
    case '$nin': return Array.isArray(operand) && !operand.some(v => looseEq(docVal, v));
    case '$exists':
      return operand ? docVal !== undefined : docVal === undefined;
    case '$regex': {
      if (docVal == null) return false;
      const src   = typeof operand === 'string' ? operand : String(operand);
      const flags = '';
      try { return new RegExp(src, flags).test(String(docVal)); } catch (_) { return false; }
    }
    case '$options': return true; // handled alongside $regex
    case '$all':
      if (!Array.isArray(docVal)) return false;
      return Array.isArray(operand) && operand.every(v => docVal.some(d => looseEq(d, v)));
    case '$size':
      return Array.isArray(docVal) && docVal.length === operand;
    case '$elemMatch':
      return Array.isArray(docVal) && docVal.some(elem => matchesQuery(elem, operand));
    case '$not': {
      if (typeof operand === 'object' && operand !== null) {
        return !evalQueryValue(docVal, operand);
      }
      return true;
    }
    default: return true; // unknown operators: pass-through
  }
}

/** Evaluate a field-level query expression (may be a primitive or operator map). */
function evalQueryValue(docVal, expr) {
  if (expr instanceof RegExp) return expr.test(String(docVal));
  if (expr === null)          return docVal === null || docVal === undefined;
  if (typeof expr !== 'object') return looseEq(docVal, expr);
  // expr is an object — check if it has $ operators
  const ops = Object.keys(expr).filter(k => k.startsWith('$'));
  if (ops.length === 0) {
    // Plain object equality (for embedded docs)
    return looseEq(String(docVal), String(expr));
  }
  // Handle $regex + $options together
  if (expr.$regex !== undefined) {
    const flags = expr.$options || '';
    const src   = typeof expr.$regex === 'string' ? expr.$regex : String(expr.$regex);
    try { return new RegExp(src, flags).test(String(docVal ?? '')); } catch (_) { return false; }
  }
  return ops.every(op => evalOperator(docVal, op, expr[op]));
}

/** Test whether a document matches a Mongo-style query object. */
function matchesQuery(doc, query) {
  if (!query || typeof query !== 'object') return true;
  for (const [key, cond] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(cond) || !cond.some(q => matchesQuery(doc, q))) return false;
    } else if (key === '$and') {
      if (!Array.isArray(cond) || !cond.every(q => matchesQuery(doc, q))) return false;
    } else if (key === '$nor') {
      if (!Array.isArray(cond) || cond.some(q => matchesQuery(doc, q))) return false;
    } else if (key === '$where') {
      // Not supported in JSON engine
    } else {
      const docVal = getPath(doc, key);
      if (!evalQueryValue(docVal, cond)) return false;
    }
  }
  return true;
}

// ─── Update operators ─────────────────────────────────────────────────────────

function applyUpdate(doc, update) {
  // Detect "replacement" vs "operator update"
  const hasOperators = Object.keys(update).some(k => k.startsWith('$'));
  if (!hasOperators) {
    // Full replacement (preserve _id, timestamps managed by caller)
    const _id = doc._id;
    const result = Object.assign({}, update, { _id });
    result.updatedAt = new Date().toISOString();
    return result;
  }

  const out = JSON.parse(JSON.stringify(doc)); // deep clone

  for (const [op, fields] of Object.entries(update)) {
    if (!fields || typeof fields !== 'object') continue;
    switch (op) {
      case '$set':
        for (const [p, v] of Object.entries(fields)) setPath(out, p, v);
        break;
      case '$unset':
        for (const p of Object.keys(fields)) {
          const parts = p.split('.');
          let cur = out;
          for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] == null) { cur = null; break; }
            cur = cur[parts[i]];
          }
          if (cur) delete cur[parts[parts.length - 1]];
        }
        break;
      case '$inc':
        for (const [p, v] of Object.entries(fields)) {
          const cur = getPath(out, p);
          setPath(out, p, (typeof cur === 'number' ? cur : 0) + v);
        }
        break;
      case '$push':
        for (const [p, v] of Object.entries(fields)) {
          let arr = getPath(out, p);
          if (!Array.isArray(arr)) arr = [];
          if (v && typeof v === 'object' && v.$each) {
            const slice = v.$slice;
            arr.push(...(v.$each || []));
            if (typeof slice === 'number') arr = arr.slice(slice < 0 ? slice : 0, slice >= 0 ? slice : undefined);
          } else {
            arr.push(v);
          }
          setPath(out, p, arr);
        }
        break;
      case '$pull':
        for (const [p, cond] of Object.entries(fields)) {
          let arr = getPath(out, p);
          if (!Array.isArray(arr)) continue;
          arr = arr.filter(item => {
            if (typeof cond === 'object' && cond !== null && !Array.isArray(cond)) {
              return !matchesQuery(item, cond);
            }
            return !looseEq(item, cond);
          });
          setPath(out, p, arr);
        }
        break;
      case '$addToSet':
        for (const [p, v] of Object.entries(fields)) {
          let arr = getPath(out, p);
          if (!Array.isArray(arr)) arr = [];
          if (!arr.some(existing => looseEq(existing, v))) arr.push(v);
          setPath(out, p, arr);
        }
        break;
      case '$pop':
        for (const [p, v] of Object.entries(fields)) {
          const arr = getPath(out, p);
          if (!Array.isArray(arr)) continue;
          if (v === 1) arr.pop(); else arr.shift();
          setPath(out, p, arr);
        }
        break;
      case '$rename':
        for (const [oldP, newP] of Object.entries(fields)) {
          const val = getPath(out, oldP);
          const parts = oldP.split('.');
          let cur = out;
          for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
          delete cur[parts[parts.length - 1]];
          setPath(out, newP, val);
        }
        break;
      case '$mul':
        for (const [p, v] of Object.entries(fields)) {
          const cur = getPath(out, p);
          setPath(out, p, (typeof cur === 'number' ? cur : 0) * v);
        }
        break;
      default:
        // Silently ignore unknown operators
        break;
    }
  }

  out.updatedAt = new Date().toISOString();
  return out;
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortDocs(docs, sortSpec) {
  if (!sortSpec) return docs;
  const entries = typeof sortSpec === 'string'
    ? [[sortSpec, 1]]
    : Array.isArray(sortSpec)
      ? sortSpec.map(s => typeof s === 'string' ? [s, 1] : s)
      : Object.entries(sortSpec);

  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = getPath(a, field);
      const bv = getPath(b, field);
      if (av === bv) continue;
      if (av == null) return dir === 1 ? 1 : -1;
      if (bv == null) return dir === 1 ? -1 : 1;
      const cmp = av < bv ? -1 : 1;
      return dir === 1 ? cmp : -cmp;
    }
    return 0;
  });
}

// ─── Projection ───────────────────────────────────────────────────────────────

function projectDoc(doc, projection) {
  if (!projection) return doc;

  // Handle string projection: "name email -password"
  if (typeof projection === 'string') {
    const parts = projection.trim().split(/\s+/);
    const include = parts.filter(p => !p.startsWith('-')).filter(p => !p.startsWith('+'));
    const exclude = parts.filter(p => p.startsWith('-')).map(p => p.slice(1));
    const forceInclude = parts.filter(p => p.startsWith('+')).map(p => p.slice(1));

    // Fields marked select:false stored with a special prefix in collection meta
    // Here we use convention: forceInclude means always include even if excluded by default
    if (include.length > 0) {
      const result = { _id: doc._id };
      for (const f of [...include, ...forceInclude]) setPath(result, f, getPath(doc, f));
      return result;
    }
    if (exclude.length > 0) {
      const result = Object.assign({}, doc);
      for (const f of exclude) delete result[f];
      for (const f of forceInclude) setPath(result, f, getPath(doc, f));
      return result;
    }
    return doc;
  }

  // Object projection
  const keys   = Object.keys(projection);
  const mode   = keys.some(k => projection[k] === 1) ? 'include' : 'exclude';
  const result = {};

  if (mode === 'include') {
    result._id = doc._id;
    for (const k of keys) {
      if (projection[k]) setPath(result, k, getPath(doc, k));
    }
  } else {
    Object.assign(result, doc);
    for (const k of keys) {
      if (!projection[k]) delete result[k];
    }
  }
  return result;
}

// ─── Aggregate pipeline ───────────────────────────────────────────────────────

function aggregate(collection, pipeline) {
  let docs = loadCollection(collection).map(d => Object.assign({}, d));

  for (const stage of (pipeline || [])) {
    const [op] = Object.keys(stage);
    const arg  = stage[op];

    switch (op) {
      case '$match':
        docs = docs.filter(d => matchesQuery(d, arg));
        break;

      case '$sort':
        docs = sortDocs(docs, arg);
        break;

      case '$skip':
        docs = docs.slice(arg);
        break;

      case '$limit':
        docs = docs.slice(0, arg);
        break;

      case '$project':
        docs = docs.map(d => projectDoc(d, arg));
        break;

      case '$unwind': {
        const field    = typeof arg === 'string' ? arg.replace(/^\$/, '') : arg.path.replace(/^\$/, '');
        const preserve = typeof arg === 'object' && arg.preserveNullAndEmptyArrays;
        const unwound  = [];
        for (const doc of docs) {
          const arr = getPath(doc, field);
          if (!Array.isArray(arr) || arr.length === 0) {
            if (preserve) unwound.push(doc);
            continue;
          }
          for (const item of arr) {
            const clone = JSON.parse(JSON.stringify(doc));
            setPath(clone, field, item);
            unwound.push(clone);
          }
        }
        docs = unwound;
        break;
      }

      case '$group': {
        const idExpr = arg._id;
        const groups = new Map();

        for (const doc of docs) {
          // Resolve group key
          let key;
          if (idExpr === null) {
            key = '__all__';
          } else if (typeof idExpr === 'string' && idExpr.startsWith('$')) {
            key = String(getPath(doc, idExpr.slice(1)) ?? 'null');
          } else if (typeof idExpr === 'object' && idExpr !== null) {
            const parts = {};
            for (const [k, v] of Object.entries(idExpr)) {
              if (typeof v === 'string' && v.startsWith('$')) {
                parts[k] = getPath(doc, v.slice(1));
              } else {
                parts[k] = v;
              }
            }
            key = JSON.stringify(parts);
          } else {
            key = String(idExpr);
          }

          if (!groups.has(key)) {
            // Build initial accumulator state
            const acc = { _id: key === '__all__' ? null : (typeof idExpr === 'object' ? JSON.parse(key) : getPath(doc, idExpr.slice(1))) };
            for (const [outField, accExpr] of Object.entries(arg)) {
              if (outField === '_id') continue;
              const accOp = Object.keys(accExpr)[0];
              switch (accOp) {
                case '$sum':   acc[outField] = 0;   break;
                case '$avg':   acc[outField] = { sum: 0, count: 0 }; break;
                case '$count': acc[outField] = 0;   break;
                case '$min':   acc[outField] = Infinity;  break;
                case '$max':   acc[outField] = -Infinity; break;
                case '$push':  acc[outField] = []; break;
                case '$addToSet': acc[outField] = []; break;
                case '$first': acc[outField] = undefined; break;
                case '$last':  acc[outField] = undefined; break;
                default:       acc[outField] = 0;
              }
            }
            groups.set(key, acc);
          }

          const acc = groups.get(key);
          for (const [outField, accExpr] of Object.entries(arg)) {
            if (outField === '_id') continue;
            const accOp  = Object.keys(accExpr)[0];
            const valExpr = accExpr[accOp];
            const val = (typeof valExpr === 'string' && valExpr.startsWith('$'))
              ? getPath(doc, valExpr.slice(1))
              : (typeof valExpr === 'number' ? valExpr : 1);

            switch (accOp) {
              case '$sum':
                acc[outField] += (typeof val === 'number' ? val : 0);
                break;
              case '$avg':
                acc[outField].sum   += (typeof val === 'number' ? val : 0);
                acc[outField].count += 1;
                break;
              case '$count':
                acc[outField] += 1;
                break;
              case '$min':
                if (val != null && val < acc[outField]) acc[outField] = val;
                break;
              case '$max':
                if (val != null && val > acc[outField]) acc[outField] = val;
                break;
              case '$push':
                acc[outField].push(val);
                break;
              case '$addToSet':
                if (!acc[outField].some(x => looseEq(x, val))) acc[outField].push(val);
                break;
              case '$first':
                if (acc[outField] === undefined) acc[outField] = val;
                break;
              case '$last':
                acc[outField] = val;
                break;
              default:
                break;
            }
          }
        }

        // Finalise accumulators
        docs = [...groups.values()].map(acc => {
          const out = {};
          for (const [k, v] of Object.entries(acc)) {
            if (v && typeof v === 'object' && 'sum' in v && 'count' in v) {
              out[k] = v.count > 0 ? v.sum / v.count : 0; // $avg finalisation
            } else if (v === Infinity || v === -Infinity) {
              out[k] = 0;
            } else {
              out[k] = v;
            }
          }
          return out;
        });
        break;
      }

      case '$lookup': {
        const { from, localField, foreignField, as: asField } = arg;
        const foreign = loadCollection(from);
        docs = docs.map(doc => {
          const localVal = getPath(doc, localField);
          const matches  = foreign.filter(fd => looseEq(getPath(fd, foreignField), localVal));
          return Object.assign({}, doc, { [asField]: matches });
        });
        break;
      }

      case '$addFields':
      case '$set': {
        docs = docs.map(doc => {
          const out = Object.assign({}, doc);
          for (const [field, expr] of Object.entries(arg)) {
            if (typeof expr === 'string' && expr.startsWith('$')) {
              out[field] = getPath(doc, expr.slice(1));
            } else {
              out[field] = expr;
            }
          }
          return out;
        });
        break;
      }

      case '$count': {
        const countField = arg;
        docs = [{ [countField]: docs.length }];
        break;
      }

      case '$replaceRoot': {
        docs = docs.map(doc => {
          const expr = arg.newRoot;
          if (typeof expr === 'string' && expr.startsWith('$')) {
            return Object.assign({}, getPath(doc, expr.slice(1)));
          }
          return Object.assign({}, expr);
        });
        break;
      }

      default:
        // Unknown pipeline stage: pass through unchanged
        break;
    }
  }

  return docs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const db = {
  generateId,

  /**
   * Find documents matching query with optional sort/skip/limit/projection.
   */
  find(collection, query = {}, options = {}) {
    let docs = loadCollection(collection).filter(d => matchesQuery(d, query));
    if (options.sort)  docs = sortDocs(docs, options.sort);
    if (options.skip)  docs = docs.slice(options.skip);
    if (options.limit) docs = docs.slice(0, options.limit);
    if (options.projection) docs = docs.map(d => projectDoc(d, options.projection));
    return docs;
  },

  /** Find the first document matching query. */
  findOne(collection, query = {}) {
    const docs = loadCollection(collection);
    return docs.find(d => matchesQuery(d, query)) || null;
  },

  /** Find a document by its _id field. */
  findById(collection, id) {
    if (!id) return null;
    const docs = loadCollection(collection);
    return docs.find(d => looseEq(d._id, id)) || null;
  },

  /**
   * Insert a document. Auto-generates _id, createdAt, updatedAt.
   * Returns the inserted document.
   */
  insert(collection, doc) {
    const docs = loadCollection(collection);
    const now  = new Date().toISOString();
    const newDoc = Object.assign(
      { _id: generateId(), createdAt: now, updatedAt: now },
      doc
    );
    docs.push(newDoc);
    saveCollection(collection, docs);
    return newDoc;
  },

  /**
   * Update documents matching query. Returns { n, nModified }.
   * options.multi  — update all matches (default false)
   * options.upsert — insert if no match (default false)
   * options.new    — return new doc (default false)
   */
  update(collection, query = {}, update = {}, options = {}) {
    return enqueueWrite(collection, () => {
      const docs    = loadCollection(collection);
      let nModified = 0;
      let n         = 0;
      let lastDoc   = null;

      for (let i = 0; i < docs.length; i++) {
        if (!matchesQuery(docs[i], query)) continue;
        n++;
        docs[i]  = applyUpdate(docs[i], update);
        lastDoc  = docs[i];
        nModified++;
        if (!options.multi) break;
      }

      if (n === 0 && options.upsert) {
        const base   = Object.assign({}, query);
        const upDoc  = applyUpdate(base, update);
        if (!upDoc._id) upDoc._id = generateId();
        const now    = new Date().toISOString();
        upDoc.createdAt = upDoc.createdAt || now;
        upDoc.updatedAt = now;
        docs.push(upDoc);
        nModified = 1;
        n         = 1;
        lastDoc   = upDoc;
      }

      saveCollection(collection, docs);
      return { n, nModified, doc: options.new ? lastDoc : null };
    });
  },

  /** Remove documents matching query. Returns removed count. */
  remove(collection, query = {}, options = {}) {
    return enqueueWrite(collection, () => {
      const docs    = loadCollection(collection);
      let removed   = 0;
      const kept    = [];
      for (const doc of docs) {
        if (matchesQuery(doc, query) && (options.multi !== false || removed === 0)) {
          removed++;
          if (!options.multi) { kept.push(...docs.slice(docs.indexOf(doc) + 1)); break; }
        } else {
          kept.push(doc);
        }
      }
      if (removed > 0) saveCollection(collection, kept);
      return removed;
    });
  },

  /** Remove a document by _id. Returns removed count. */
  removeById(collection, id) {
    return enqueueWrite(collection, () => {
      const docs  = loadCollection(collection);
      const idx   = docs.findIndex(d => looseEq(d._id, id));
      if (idx === -1) return 0;
      docs.splice(idx, 1);
      saveCollection(collection, docs);
      return 1;
    });
  },

  /** Count documents matching query. */
  count(collection, query = {}) {
    return loadCollection(collection).filter(d => matchesQuery(d, query)).length;
  },

  /** Run an aggregation pipeline. */
  aggregate(collection, pipeline) {
    return aggregate(collection, pipeline);
  },

  /** Expose helpers for use by JsonModel. */
  matchesQuery,
  applyUpdate,
  sortDocs,
  projectDoc,
  getPath,
  setPath,
  looseEq,
  loadCollection,
  saveCollection,
};

module.exports = db;
