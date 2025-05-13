// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

/**
 * Normalize role capitalization
 */
function normalizeRole(role) {
  if (!role) return 'Customer'; // Default role
  
  const roleLower = role.toLowerCase();
  
  if (roleLower === 'superadmin') return 'SuperAdmin';
  if (roleLower === 'admin') return 'Admin';
  if (roleLower === 'driver') return 'Driver';
  return 'Customer'; // Default case
}

/**
 * Middleware to authenticate users via JWT from cookies
 * but also supports traditional Authorization header as fallback
 */
const authenticate = (req, res, next) => {
  // First try to get token from cookies (new method)
  let token = req.cookies.accessToken;
  let source = 'cookie';
  
  // If no cookie, fall back to Authorization header (legacy support)
  if (!token && req.headers.authorization) {
    console.log("🔍 Incoming Auth Header:", req.headers.authorization);
    const authHeader = req.headers.authorization;
    
    // Properly extract token, handling multiple "Bearer" prefixes
    if (authHeader.startsWith("Bearer ")) {
      // Remove all instances of "Bearer " (with a space)
      token = authHeader.replace(/Bearer\s+/gi, "").trim();
    } else {
      token = authHeader.trim();
    }
    source = 'header';
  }
  
  // Check if we have a token from either source
  if (!token) {
    console.log("❌ No authentication token found (neither cookie nor header)");
    return res.status(401).json({ message: "No token, authorization denied" });
  }
  
  console.log(`✅ Extracted Token from ${source}:`, token.substring(0, 10) + '...');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "yoursecretkey");
    console.log("✅ Token Decoded Successfully:", decoded);

    // Normalize role to ensure consistent capitalization
    const normalizedRole = normalizeRole(decoded.role);
    
    // Attach normalized user to request
    req.user = {
      ...decoded,
      role: normalizedRole
    }; 
    
    console.log("User role normalized to:", normalizedRole);
    next();
  } catch (error) {
    console.error("❌ Token Verification Failed:", error.message);
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};

/**
 * Middleware to authorize users based on roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log("❌ User not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Normalize the required roles for comparison
    const normalizedRequiredRoles = roles.map(role => normalizeRole(role));
    
    // For role comparison, normalize the user's role again to be safe
    const userRole = normalizeRole(req.user.role);
    
    if (normalizedRequiredRoles.length && !normalizedRequiredRoles.includes(userRole)) {
      console.log(`❌ User role '${userRole}' is not authorized for this action`);
      console.log(`Required roles: ${JSON.stringify(normalizedRequiredRoles)}`);
      return res.status(403).json({ message: "Not authorized for this action" });
    }

    console.log("✅ User is authorized:", userRole);
    next();
  };
};

module.exports = { authenticate, authorize };
