const { Notification } = require('../models');

/**
 * Create a notification for an agent. Skips duplicates: an unread notification
 * of the same type for the same record already exists (same as the old client logic).
 */
const notify = async (agentId, { type, title, message, related_id, related_type }) => {
  if (!agentId) return null;
  if (related_id && related_type) {
    const existing = await Notification.exists({ agent_id: agentId, related_id: String(related_id), related_type, type, read: false });
    if (existing) return null;
  }
  try {
    return await Notification.create({
      agent_id: agentId,
      type,
      title,
      message,
      related_id: related_id ? String(related_id) : undefined,
      related_type: Notification.RELATED_TYPES.includes(related_type) ? related_type : undefined,
    });
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return null;
  }
};

const list = (agentId, limit = 50) => Notification.find({ agent_id: agentId }).sort({ created_at: -1 }).limit(limit).lean();
const unreadCount = (agentId) => Notification.countDocuments({ agent_id: agentId, read: false });
const markRead = (agentId, id) => Notification.updateOne({ _id: id, agent_id: agentId }, { $set: { read: true } });
const markAllRead = (agentId) => Notification.updateMany({ agent_id: agentId, read: false }, { $set: { read: true } });
const remove = (agentId, id) => Notification.deleteOne({ _id: id, agent_id: agentId });
const clear = (agentId) => Notification.deleteMany({ agent_id: agentId });

module.exports = { notify, list, unreadCount, markRead, markAllRead, remove, clear };
