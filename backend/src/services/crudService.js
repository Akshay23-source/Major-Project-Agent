/**
 * Generic agent-scoped CRUD for simple agent-owned registries (farmers, buyers, employees).
 * Every query is filtered by agent_id, so one agent can never read or change another's data.
 */
const { notFound } = require('../utils/http');

const PROTECTED = ['_id', 'id', 'agent_id', 'created_at', 'updated_at'];
const clean = (data) => {
  const out = { ...data };
  for (const k of PROTECTED) delete out[k];
  return out;
};

const makeCrud = (Model, { label, beforeCreate } = {}) => ({
  list: (agentId) => Model.find({ agent_id: agentId }).sort({ created_at: -1 }).lean(),

  get: async (agentId, id) => {
    const doc = await Model.findOne({ _id: id, agent_id: agentId }).lean();
    if (!doc) throw notFound(`${label} not found`);
    return doc;
  },

  create: async (agentId, data) => {
    const payload = clean(data);
    if (beforeCreate) Object.assign(payload, await beforeCreate(agentId, payload));
    const doc = await Model.create({ ...payload, agent_id: agentId });
    return doc.toObject();
  },

  update: async (agentId, id, data) => {
    const doc = await Model.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: clean(data) }, { returnDocument: 'after', runValidators: true }).lean();
    if (!doc) throw notFound(`${label} not found`);
    return doc;
  },

  remove: async (agentId, id) => {
    const res = await Model.deleteOne({ _id: id, agent_id: agentId });
    if (!res.deletedCount) throw notFound(`${label} not found`);
  },
});

module.exports = { makeCrud, clean };
