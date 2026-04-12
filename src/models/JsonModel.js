/**
 * JsonModel — Mongoose-compatible model factory backed by JSON files.
 *
 * Drop-in replacement for Mongoose models when USE_JSON_DB=true.
 * Controllers require('../models/User') and get back either a real Mongoose
 * model (default) or a JsonModel instance (when USE_JSON_DB=true).
 *
 * Supported API surface:
 *   Static : find · findOne · findById · create · insertMany
 *            findByIdAndUpdate · findByIdAndDelete · findOneAndUpdate
 *            countDocuments · aggregate · bulkWrite
 *   Query  : .sort() · .skip() · .limit() · .select() · .lean() · .populate() · .exec()
 *   Instance: save() · remove() · updateOne() · toObject() · toJSON()
 *
 * @version 1.0.0
 */

'use strict';

const db = require('../config/jsonDb');

// ─── Global model registry (collection name → Model) ─────────────────────────
const _registry = Object.create(null);

// ─── Default-exclude field sets per collection ────────────────────────────────
// These mirror Mongoose's `select: false` fields.
const SELECT_FALSE_FIELDS = {
  users: ['password', 'refreshToken', 'passwordResetToken', 'passwordResetExpires',
          'otpCode', 'otpExpires', 'otpAttempts'],
};

// ─── Document proxy ───────────────────────────────────────────────────────────

/**
 * Wrap raw data in a proxy so that field reads / writes go through __data,
 * while methods defined on the prototype are still accessible.
 */
function makeProxy(instance) {
  return new Proxy(instance, {
    get(target, prop, receiver) {
      // Own properties and prototype methods have priority
      if (prop in target) return Reflect.get(target, prop, receiver);
      // Fall back to __data
      const d = target.__data;
      if (d && prop in d) return d[prop];
      return undefined;
    },
    set(target, prop, value) {
      if (
        prop === '__data'       ||
        prop === '__isNew'      ||
        prop === '__model'      ||
        prop === '__dirty'      ||
        typeof target[prop] === 'function'
      ) {
        target[prop] = value;
      } else {
        target.__data[prop] = value;
      }
      return true;
    },
    has(target, prop) {
      return prop in target || (target.__data && prop in target.__data);
    },
    ownKeys(target) {
      return [
        ...new Set([
          ...Reflect.ownKeys(target),
          ...(target.__data ? Object.keys(target.__data) : []),
        ]),
      ];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target) return Reflect.getOwnPropertyDescriptor(target, prop);
      if (target.__data && prop in target.__data) {
        return { value: target.__data[prop], writable: true, enumerable: true, configurable: true };
      }
      return undefined;
    },
  });
}

// ─── Query Builder ────────────────────────────────────────────────────────────

class Query {
  constructor(model, execFn) {
    this._model  = model;
    this._exec   = execFn;       // () => Promise
    this._sort   = null;
    this._skip   = 0;
    this._limit  = 0;
    this._select = null;
    this._pops   = [];           // [{path, select}]
    this._lean   = false;
  }

  sort(spec) {
    if (typeof spec === 'string') {
      // "field" or "-field" or "field1 -field2"
      const obj = {};
      for (const token of spec.split(/\s+/)) {
        if (token.startsWith('-')) obj[token.slice(1)] = -1;
        else                       obj[token]          =  1;
      }
      this._sort = obj;
    } else {
      this._sort = spec;
    }
    return this;
  }

  skip(n)        { this._skip  = parseInt(n) || 0; return this; }
  limit(n)       { this._limit = parseInt(n) || 0; return this; }
  select(fields) { this._select = fields; return this; }
  lean(val)      { this._lean  = val !== false;   return this; }

  populate(pathOrObj, selectStr) {
    if (typeof pathOrObj === 'string') {
      this._pops.push({ path: pathOrObj, select: selectStr || null });
    } else if (Array.isArray(pathOrObj)) {
      for (const p of pathOrObj) this.populate(p);
    } else if (pathOrObj && typeof pathOrObj === 'object') {
      this._pops.push({ path: pathOrObj.path, select: pathOrObj.select || null });
    }
    return this;
  }

  async exec() {
    let result = await this._exec({ sort: this._sort, skip: this._skip, limit: this._limit });

    if (!result) return result;

    const isArray = Array.isArray(result);
    let processed = isArray ? result : [result];

    // Apply select / projection
    if (this._select) {
      processed = processed.map(doc => {
        const raw  = doc && typeof doc.toObject === 'function' ? doc.toObject() : (doc || {});
        const proj = db.projectDoc(raw, this._select);
        return this._lean ? proj : this._model._wrap(proj);
      });
    }

    // Populate
    if (this._pops.length > 0) {
      processed = await Promise.all(processed.map(doc => this._populateDoc(doc)));
    }

    // Lean (strip Document wrappers)
    if (this._lean && !this._select) {
      processed = processed.map(doc =>
        doc && typeof doc.toObject === 'function' ? doc.toObject() : doc
      );
    }

    return isArray ? processed : (processed[0] || null);
  }

  async _populateDoc(doc) {
    const data = doc && typeof doc.toObject === 'function' ? doc.toObject() : (doc || {});
    const populated = Object.assign({}, data);

    for (const pop of this._pops) {
      const refVal = db.getPath(populated, pop.path);
      if (!refVal) continue;

      // Resolve the target collection via the model's populateRefs map
      const refs   = this._model._populateRefs || {};
      const target = refs[pop.path];
      if (!target) continue;

      const refCollection = typeof target === 'string' ? target : target.collection;
      const refModel      = _registry[refCollection] || _registry[target.model] || null;

      const fetchOne = (id) => {
        if (!id) return null;
        const found = db.findById(refCollection, id);
        if (!found) return null;
        if (refModel) {
          const wrapped = refModel._wrap(found);
          return pop.select ? db.projectDoc(found, pop.select) : wrapped;
        }
        return found;
      };

      if (Array.isArray(refVal)) {
        db.setPath(populated, pop.path, refVal.map(fetchOne));
      } else {
        db.setPath(populated, pop.path, fetchOne(refVal));
      }
    }

    return this._lean ? populated : this._model._wrap(populated);
  }

  // Make Query thenable (await query works without .exec())
  then(res, rej) { return this.exec().then(res, rej); }
  catch(rej)     { return this.exec().catch(rej); }
}

// ─── Base Document class ─────────────────────────────────────────────────────

class BaseDocument {
  constructor(data, model) {
    this.__model  = model;
    this.__isNew  = true;
    this.__dirty  = false;
    this.__data   = Object.assign({}, data || {});
    return makeProxy(this);
  }

  /** Persist to the JSON file. Handles both insert and update. */
  async save() {
    const model = this.__model;
    const col   = model._collection;

    // Run any pre-save hooks BEFORE reading data so mutations are captured
    if (model._preSave) {
      await model._preSave.call(this);
    }

    // Read data after hooks may have modified it
    const data = Object.assign({}, this.__data);

    if (this.__isNew || !data._id) {
      const inserted = db.insert(col, data);
      Object.assign(this.__data, inserted);
      this.__isNew = false;
    } else {
      // Build a $set update from current data
      await db.update(col, { _id: data._id }, { $set: data });
      this.__data.updatedAt = new Date().toISOString();
    }
    return this;
  }

  /** Delete this document from the collection. */
  async remove() {
    const id = this.__data._id;
    if (id) await db.removeById(this.__model._collection, id);
    return this;
  }

  /** Update this document with an operator object and persist. */
  async updateOne(update) {
    const id = this.__data._id;
    if (!id) return this;
    const res = await db.update(this.__model._collection, { _id: id }, update, { new: true });
    if (res && res.doc) Object.assign(this.__data, res.doc);
    return this;
  }

  toObject(opts) {
    void opts;
    return JSON.parse(JSON.stringify(this.__data));
  }

  toJSON() {
    return this.toObject();
  }

  /** Allow instanceof checks to pass through proxy. */
  static [Symbol.hasInstance](instance) {
    return instance && typeof instance === 'object' && instance.__data !== undefined;
  }
}

// ─── Model factory ────────────────────────────────────────────────────────────

/**
 * @param {string} collectionName  - JSON file name without extension, e.g. "users"
 * @param {string} modelName       - Optional registry name, e.g. "User"
 * @param {object} [opts]
 * @param {object} [opts.instanceMethods]  - Methods added to Document prototype
 * @param {object} [opts.statics]          - Methods added to Model as static
 * @param {object} [opts.populateRefs]     - { fieldName: collectionName | {collection, model} }
 * @param {Function} [opts.preSave]        - async pre-save hook(this=instance)
 */
function createJsonModel(collectionName, modelName, opts = {}) {
  if (typeof modelName === 'object') { opts = modelName; modelName = collectionName; }

  const col = collectionName;

  // Build a custom Document class for this model
  class ModelDocument extends BaseDocument {
    constructor(data) { super(data, Model); }
  }

  // Attach instance methods
  if (opts.instanceMethods) {
    Object.assign(ModelDocument.prototype, opts.instanceMethods);
  }

  // ─── The Model object (static methods) ───────────────────────────────────
  const Model = {
    _collection:   col,
    _modelName:    modelName || col,
    _populateRefs: opts.populateRefs || {},
    _preSave:      opts.preSave || null,
    _Document:     ModelDocument,

    /** Wrap raw data in a Document proxy. Internal helper. */
    _wrap(raw) {
      if (!raw) return null;
      const doc     = new ModelDocument(raw);
      doc.__isNew   = false;
      return doc;
    },

    // ── new Model(data) support ───────────────────────────────────────────
    // Allow callers to do `new Model({...})`
  };

  // Make Model a callable constructor too: new Model({ ... })
  function ModelConstructor(data) {
    const doc   = new ModelDocument(data || {});
    doc.__isNew = true;
    return doc;
  }
  // Copy all model statics onto the constructor
  Object.assign(ModelConstructor, Model);
  // Keep reference back to Model for later static additions
  ModelConstructor._model = Model;

  function _wrap(raw) { return ModelConstructor._wrap(raw); }

  // ── Static query methods ────────────────────────────────────────────────

  ModelConstructor.find = function(query = {}, projection) {
    const execFn = (opts2) => {
      let docs = db.find(col, query, {
        sort:       opts2.sort,
        skip:       opts2.skip  || 0,
        limit:      opts2.limit || 0,
        projection: projection || null,
      });
      return Promise.resolve(docs.map(d => _wrap(d)));
    };
    return new Query(ModelConstructor, execFn);
  };

  ModelConstructor.findOne = function(query = {}, projection) {
    const execFn = (_opts) => {
      const docs = db.find(col, query, { projection: projection || null });
      return Promise.resolve(docs.length ? _wrap(docs[0]) : null);
    };
    return new Query(ModelConstructor, execFn);
  };

  ModelConstructor.findById = function(id, projection) {
    const execFn = (_opts) => {
      if (!id) return Promise.resolve(null);
      const raw = db.findById(col, id);
      if (!raw) return Promise.resolve(null);
      const doc = projection ? db.projectDoc(raw, projection) : raw;
      return Promise.resolve(_wrap(doc));
    };
    return new Query(ModelConstructor, execFn);
  };

  ModelConstructor.create = async function(data) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(d => ModelConstructor.create(d)));
    }
    const doc = new ModelDocument(data);
    doc.__isNew = true;
    if (ModelConstructor._preSave) {
      await ModelConstructor._preSave.call(doc);
    }
    const inserted = db.insert(col, Object.assign({}, doc.__data));
    Object.assign(doc.__data, inserted);
    doc.__isNew = false;
    return doc;
  };

  ModelConstructor.insertMany = async function(docs) {
    return Promise.all((docs || []).map(d => ModelConstructor.create(d)));
  };

  ModelConstructor.findByIdAndUpdate = function(id, update, options = {}) {
    const execFn = async (_opts) => {
      if (!id) return null;
      const result = await db.update(col, { _id: id }, update, { new: !!options.new || !!options.returnDocument });
      if (options.new || options.returnDocument === 'after') {
        const fresh = db.findById(col, id);
        return fresh ? _wrap(fresh) : null;
      }
      const before = db.findById(col, id);
      return before ? _wrap(before) : null;
    };
    if (options.exec !== false) {
      const q = new Query(ModelConstructor, execFn);
      return q;
    }
    return execFn({});
  };

  ModelConstructor.findByIdAndDelete = async function(id) {
    if (!id) return null;
    const raw = db.findById(col, id);
    if (!raw) return null;
    await db.removeById(col, id);
    return _wrap(raw);
  };

  ModelConstructor.findOneAndUpdate = function(query, update, options = {}) {
    const execFn = async (_opts) => {
      const existing = db.findOne(col, query);
      if (!existing) {
        if (options.upsert) {
          const res = await db.update(col, query, update, { upsert: true, new: true });
          if (res && res.doc) return _wrap(res.doc);
        }
        return null;
      }
      await db.update(col, { _id: existing._id }, update);
      if (options.new || options.returnDocument === 'after') {
        return _wrap(db.findById(col, existing._id));
      }
      return _wrap(existing);
    };
    return new Query(ModelConstructor, execFn);
  };

  ModelConstructor.findOneAndDelete = async function(query) {
    const raw = db.findOne(col, query);
    if (!raw) return null;
    await db.removeById(col, raw._id);
    return _wrap(raw);
  };

  ModelConstructor.updateOne = async function(query, update, options = {}) {
    const res = await db.update(col, query, update, { ...options, multi: false });
    return { acknowledged: true, matchedCount: res.n, modifiedCount: res.nModified };
  };

  ModelConstructor.updateMany = async function(query, update, options = {}) {
    const res = await db.update(col, query, update, { ...options, multi: true });
    return { acknowledged: true, matchedCount: res.n, modifiedCount: res.nModified };
  };

  ModelConstructor.deleteOne = async function(query) {
    const n = await db.remove(col, query, { multi: false });
    return { acknowledged: true, deletedCount: n };
  };

  ModelConstructor.deleteMany = async function(query) {
    const n = await db.remove(col, query, { multi: true });
    return { acknowledged: true, deletedCount: n };
  };

  ModelConstructor.countDocuments = function(query = {}) {
    // Returns a thenable for compatibility with await countDocuments(query)
    const count = db.count(col, query);
    return Promise.resolve(count);
  };

  ModelConstructor.estimatedDocumentCount = function() {
    return Promise.resolve(db.count(col, {}));
  };

  ModelConstructor.aggregate = function(pipeline) {
    return Promise.resolve(db.aggregate(col, pipeline));
  };

  ModelConstructor.distinct = function(field, query = {}) {
    const docs = db.find(col, query);
    const vals = [...new Set(docs.map(d => db.getPath(d, field)).filter(v => v != null))];
    return Promise.resolve(vals);
  };

  ModelConstructor.bulkWrite = async function(ops) {
    let inserted = 0, upserted = 0, modified = 0, deleted = 0;
    for (const op of (ops || [])) {
      if (op.insertOne) {
        await ModelConstructor.create(op.insertOne.document);
        inserted++;
      } else if (op.updateOne) {
        const { filter, update, upsert } = op.updateOne;
        const res = await db.update(col, filter, update, { upsert: !!upsert });
        modified += res.nModified;
      } else if (op.updateMany) {
        const { filter, update, upsert } = op.updateMany;
        const res = await db.update(col, filter, update, { multi: true, upsert: !!upsert });
        modified += res.nModified;
      } else if (op.deleteOne) {
        deleted += await db.remove(col, op.deleteOne.filter, { multi: false });
      } else if (op.deleteMany) {
        deleted += await db.remove(col, op.deleteMany.filter, { multi: true });
      } else if (op.replaceOne) {
        const { filter, replacement, upsert } = op.replaceOne;
        const existing = db.findOne(col, filter);
        if (existing) {
          await db.update(col, { _id: existing._id }, replacement);
          modified++;
        } else if (upsert) {
          await ModelConstructor.create(replacement);
          upserted++;
        }
      }
    }
    return { insertedCount: inserted, upsertedCount: upserted, modifiedCount: modified, deletedCount: deleted };
  };

  // Attach extra statics
  if (opts.statics) {
    Object.assign(ModelConstructor, opts.statics);
  }

  // Register in global registry by both collection name and model name
  _registry[col]                    = ModelConstructor;
  _registry[modelName || col]       = ModelConstructor;
  if (modelName) _registry[modelName.toLowerCase()] = ModelConstructor;

  return ModelConstructor;
}

module.exports = { createJsonModel, _registry };
