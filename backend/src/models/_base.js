const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

/**
 * Every Agri Agent collection is prefixed `agri_` so it can never collide with a
 * Farm Marketplace collection in the shared database.
 */
const COLLECTION_PREFIX = 'agri_';

const baseOptions = (collection) => ({
  collection: `${COLLECTION_PREFIX}${collection}`,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
  strict: true,
});

/** Reuse an already-compiled model (jest re-requires modules). */
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

const ref = (modelName, extra = {}) => ({ type: ObjectId, ref: modelName, ...extra });

module.exports = { Schema, ObjectId, baseOptions, model, ref, COLLECTION_PREFIX };
