const { Schema, model } = require('./_base');

/** Atomic sequences for human-readable numbers (ORD-001, DLV-0001, EMP-001). */
const CounterSchema = new Schema(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { collection: 'agri_counters', versionKey: false },
);

const Counter = model('Counter', CounterSchema);

Counter.next = async (key) => {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
  return doc.seq;
};

module.exports = Counter;
