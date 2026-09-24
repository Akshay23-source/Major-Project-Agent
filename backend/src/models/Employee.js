const { Schema, baseOptions, model, ref } = require('./_base');

const EmployeeSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    name: { type: String, required: true, trim: true },
    employee_id: String,
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    role: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    assigned_area: String,
    joining_date: String,
    emergency_contact: String,
    notes: String,
    status: { type: String, default: 'Active' },
    rating: Number,
  },
  baseOptions('employees'),
);

EmployeeSchema.index({ agent_id: 1, created_at: -1 });

module.exports = model('Employee', EmployeeSchema);
