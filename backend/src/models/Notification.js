const { Schema, baseOptions, model, ref } = require('./_base');

const RELATED_TYPES = ['order', 'delivery', 'product', 'farmer', 'buyer', 'employee', 'payment', 'settlement'];

const NotificationSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    type: { type: String, required: true, maxlength: 255 },
    title: { type: String, required: true, maxlength: 255 },
    message: { type: String, required: true },
    related_id: String,
    related_type: { type: String, enum: RELATED_TYPES },
    read: { type: Boolean, default: false },
  },
  { ...baseOptions('notifications'), timestamps: { createdAt: 'created_at', updatedAt: false } },
);

NotificationSchema.index({ agent_id: 1, read: 1, created_at: -1 });

const Notification = model('Notification', NotificationSchema);
Notification.RELATED_TYPES = RELATED_TYPES;
module.exports = Notification;
