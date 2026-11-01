import React from 'react';
import SharedDashboard from '../../src/components/dashboard/SharedDashboard';
import { Role } from '../../src/lib/api';

export default function DriverDashboard() {
  return <SharedDashboard role="driver" />;
}
