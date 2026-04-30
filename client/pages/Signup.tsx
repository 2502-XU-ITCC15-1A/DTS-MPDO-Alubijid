import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState<"verify" | "register">("verify");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 — Verify if email was registered by admin
  const handleVerifyEmail = async () => {
    if (!email) return setError("Please enter your email.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.valid) {
        setName(data.name || "");
        setStep("register");
      } else {
        setError("This email is not registered by the admin. Contact your administrator.");
      }
    } catch {
      setError("Cannot connect to backend. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — Create account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your full name.");
    if (!personalEmail.trim()) return setError("Please enter your personal email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) return setError("Please enter a valid personal email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, personalEmail }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to create account.");
      navigate("/login?registered=true");
    } catch {
      setError("Cannot connect to backend. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-primary">MPDO Tracker</h1>
          </div>
          <p className="text-gray-600">Municipal Planning and Development Office</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
          <p className="text-gray-600 mb-6">Register as an MPDO staff member</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1 — Email Verification */}
          {step === "verify" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan.delacruz@alubijid.gov.ph"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyEmail()}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter the email assigned to you by the admin.
                </p>
              </div>
              <Button
                onClick={handleVerifyEmail}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3"
              >
                {loading ? "Verifying..." : "Verify Email"}
              </Button>
            </div>
          )}

          {/* Step 2 — Fill in credentials */}
          {step === "register" && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              {/* Verified email badge */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">{email}</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Personal Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Personal Email
                </label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Used to receive OTP when resetting your password.</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep("verify"); setError(""); }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          )}

          <p className="text-center text-gray-600 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:text-primary/80 transition">
              Sign In
            </Link>
          </p>
        </div>

        <div className="mt-6 bg-white rounded-xl p-5 border-2 border-primary/30">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-primary">Note:</span> Only admin-registered emails can create an account. Contact your administrator if you don't have an assigned email.
          </p>
        </div>
      </div>
    </div>
  );
}
