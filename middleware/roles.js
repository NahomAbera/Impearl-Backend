module.exports = function(requiredRoles = []) {
  return (req, res, next) => {
    try {
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (roles.length === 0 || roles.includes(req.userType)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};
