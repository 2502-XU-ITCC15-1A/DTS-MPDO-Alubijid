const { createRemoteJWKSet, jwtVerify } = require("jose");
const { supabaseAdmin } = require("../config/supabase");

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const { payload } = await jwtVerify(token, JWKS);
    req.authUser = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    console.error("[requireAuth]", err.message);
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }
}

async function requireAdminOrHead(req, res, next) {
  try {
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("role")
      .eq("email", req.authUser.email)
      .single();

    if (error || !employee) {
      return res.status(403).json({ error: "Forbidden. Employee record not found." });
    }

    if (employee.role !== "admin" && employee.role !== "head_staff") {
      return res.status(403).json({ error: "Forbidden. Admin or Head Staff access required." });
    }

    req.employeeRole = employee.role;
    next();
  } catch (err) {
    console.error("[requireAdminOrHead]", err.message);
    res.status(500).json({ error: "Authorization check failed." });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("role")
      .eq("email", req.authUser.email)
      .single();

    if (error || !employee) {
      return res.status(403).json({ error: "Forbidden. Employee record not found." });
    }

    if (employee.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin access required." });
    }

    req.employeeRole = employee.role;
    next();
  } catch (err) {
    console.error("[requireAdmin]", err.message);
    res.status(500).json({ error: "Authorization check failed." });
  }
}

module.exports = { requireAuth, requireAdminOrHead, requireAdmin };
