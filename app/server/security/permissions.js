const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  staff: [
    'school.read',
    'student.read',
    'student.write',
    'student.lifecycle',
    'curriculum.read',
    'curriculum.write',
    'selection.read',
    'selection.review',
    'teaching_group.manage',
    'schedule.read',
    'schedule.manage',
    'schedule.publish',
    'exam.read',
    'exam.write',
    'university.read',
  ],
  supervisor: [
    'school.read',
    'student.read',
    'student.write',
    'curriculum.read',
    'selection.read',
    'selection.review',
    'schedule.read',
    'exam.read',
    'exam.write',
    'university.read',
    'university.write',
  ],
  teacher: [
    'school.read',
    'student.read',
    'curriculum.read',
    'selection.read',
    'schedule.read',
    'availability.own',
    'exam.read',
    'exam.write',
    'university.read',
  ],
  student: [
    'student.read.own',
    'curriculum.read',
    'selection.read.own',
    'selection.write.own',
    'schedule.read.own',
    'exam.read.own',
    'university.read',
  ],
});

function hasPermission(user, permission) {
  if (!user || !permission) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required_permission: permission,
      });
    }
    next();
  };
}

module.exports = { ROLE_PERMISSIONS, hasPermission, requirePermission };
