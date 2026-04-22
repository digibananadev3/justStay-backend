


export const role = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(403).json({
          message: "Access denied. User role not found.",
        });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: `Access denied. This route is restricted to: ${allowedRoles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Something went wrong in role authorization",
      });
    }
  };
};