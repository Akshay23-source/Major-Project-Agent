const { Schema, baseOptions, model } = require('./_base');

/** An Agri Agent operator account (login + profile + settings). */
const AgentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    password_hash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 20 },
    role: { type: String, enum: ['ADMIN', 'AGENT'], default: 'ADMIN' },
    agent_code: { type: String, trim: true },
    assigned_area: { type: String, trim: true },
    business_name: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    notifications_enabled: { type: Boolean, default: true },
    theme: { type: String, enum: ['System', 'Light', 'Dark'], default: 'System' },
    language: { type: String, default: 'English' },
    voice_enabled: { type: Boolean, default: true },
    voice_auto_detect: { type: Boolean, default: false },
    last_login_at: Date,
  },
  baseOptions('agents'),
);

AgentSchema.index({ email: 1 }, { unique: true });

module.exports = model('Agent', AgentSchema);
