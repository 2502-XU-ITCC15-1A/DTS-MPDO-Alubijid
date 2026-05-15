const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// ── Update profile ────────────────────────────────────────────────────────────
router.post("/update-profile", requireAuth, async (req, res) => {
  const { id, name, department, personal_email } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "Employee id and name are required." });
  }

  const updates = { name, department };
  if (personal_email !== undefined) updates.personal_email = personal_email || null;

  const { data, error } = await supabaseAdmin
    .from("employees")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message || "Unable to update profile." });
  }

  return res.json({ success: true, profile: data });
});

// ── Change password ───────────────────────────────────────────────────────────
router.post("/change-password", requireAuth, async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and new password are required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) return res.status(500).json({ error: "Failed to look up user." });

  const authUser = users.find((u) => u.email === email);
  if (!authUser) return res.status(404).json({ error: "Auth account not found." });

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    password: newPassword,
  });

  if (updateErr) {
    return res.status(500).json({ error: "Failed to change password." });
  }

  return res.json({ success: true });
});

// ── Delete employee (admin only) ──────────────────────────────────────────────
router.delete("/delete-employee/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Employee ID required." });

  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", id)
    .single();

  if (empError || !employee) {
    return res.status(404).json({ error: "Employee not found." });
  }

  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return res.status(500).json({ error: "Failed to look up auth users." });
  }

  const authUser = users.find((u) => u.email === employee.email);
  if (authUser) {
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (deleteErr) {
      return res.status(500).json({ error: "Failed to delete auth account." });
    }
  }

  await supabaseAdmin
    .from("documents")
    .update({ assigned_to: null })
    .eq("assigned_to", employee.email);

  const { error: deleteEmployeeError } = await supabaseAdmin
    .from("employees")
    .delete()
    .eq("id", id);

  if (deleteEmployeeError) {
    return res.status(500).json({ error: "Failed to delete employee record." });
  }

  res.json({ success: true });
});

module.exports = router;
