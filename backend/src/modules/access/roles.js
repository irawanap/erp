const roles = Object.freeze(['Employee', 'Supervisor', 'HRD/Admin']);
const permissions = Object.freeze({
  Employee: Object.freeze(['profile:read', 'sessions:manage', 'departments:read', 'employees:read', 'leave-types:read', 'holidays:read', 'leave-balances:read', 'leave-requests:read', 'leave-requests:write', 'dashboard:read']),
  Supervisor: Object.freeze(['approvals:write', 'profile:read', 'sessions:manage', 'departments:read', 'employees:read', 'leave-types:read', 'holidays:read', 'leave-balances:read', 'leave-requests:read', 'leave-requests:write', 'dashboard:read']),
  'HRD/Admin': Object.freeze(['profile:read', 'sessions:manage', 'departments:read', 'employees:read', 'leave-types:read', 'holidays:read', 'leave-balances:read', 'leave-requests:read', 'leave-requests:write', 'dashboard:read', 'users:read', 'users:write', 'departments:write', 'employees:write', 'leave-types:write', 'holidays:write', 'leave-balances:write', 'reports:read', 'roles:read', 'audit:read']),
});

function hasPermission(role, permission) {
  return Object.hasOwn(permissions, role) && permissions[role].includes(permission);
}

module.exports = { roles, permissions, hasPermission };
