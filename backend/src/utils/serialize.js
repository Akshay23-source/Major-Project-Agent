/**
 * Convert Mongo documents into the JSON shape the Expo app consumes:
 *   _id -> id (string), ObjectIds -> strings, Dates -> ISO strings,
 *   secrets (password_hash) and __v removed.
 *
 * Field names stay snake_case (order_number, logistics_status, ...), so the
 * app's screens keep their existing field access.
 */
const { Types } = require('mongoose');

const HIDDEN = new Set(['__v', 'password_hash']);

const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toObject === 'function') return serialize(value.toObject({ depopulate: false }));
  if (value && value._bsontype === 'ObjectId') return value.toString();
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (HIDDEN.has(key)) continue;
      if (key === '_id') out.id = serialize(v);
      else out[key] = serialize(v);
    }
    return out;
  }
  return value;
};

/**
 * Attach related documents under the table-style keys the screens read, e.g.
 *   attach(orders, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name phone' })
 * gives every order `order.farmers = { id, name, phone } | null`.
 * Works on already-serialized plain objects (ids are strings).
 */
const attach = async (items, { from, as, model, select, filter = {}, many = false, localKey = 'id' }) => {
  const list = Array.isArray(items) ? items : [items];
  if (!list.length) return items;

  if (many) {
    // one-to-many: related.from === item[localKey]
    const ids = [...new Set(list.map((i) => i[localKey]).filter(Boolean))];
    const docs = ids.length ? await model.find({ ...filter, [from]: { $in: ids } }).select(select || '').lean() : [];
    const byKey = new Map();
    for (const d of serialize(docs)) {
      const k = String(d[from]);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(d);
    }
    for (const item of list) item[as] = byKey.get(String(item[localKey])) || [];
    return items;
  }

  const ids = [...new Set(list.map((i) => i[from]).filter(Boolean).map(String))];
  const docs = ids.length ? await model.find({ ...filter, _id: { $in: ids } }).select(select || '').lean() : [];
  const byId = new Map(serialize(docs).map((d) => [d.id, d]));
  for (const item of list) item[as] = item[from] ? byId.get(String(item[from])) || null : null;
  return items;
};

module.exports = { serialize, attach };
