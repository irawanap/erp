function publicUser(user) {
  return {
    id: user.public_id, employee_id: user.employee_public_id || null, email: user.email,
    role: user.role, is_active: user.is_active, last_login_at: user.last_login_at,
    created_at: user.created_at, updated_at: user.updated_at,
  };
}

module.exports = publicUser;
