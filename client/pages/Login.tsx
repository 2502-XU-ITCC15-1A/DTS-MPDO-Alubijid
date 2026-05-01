import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { FileText, Eye, EyeOff, KeyRound, Lock, CheckCircle2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "password" | "done">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const openForgot = () => {
    setShowForgot(true);
    setForgotStep("email");
    setForgotEmail("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setForgotToken("");
    setDevOtp(null);
    setForgotError("");
  };

  const handleSendOtp = async () => {
    if (!forgotEmail.trim()) return setForgotError("Please enter your email address.");
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setForgotError(data.error || "Failed to send OTP.");
      setDevOtp(data.devOtp || null);
      setForgotStep("otp");
    } catch {
      setForgotError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp.trim()) return setForgotError("Please enter the OTP.");
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setForgotError(data.error || "Invalid or expired OTP.");
      setForgotToken(data.resetToken);
      setForgotStep("password");
    } catch {
      setForgotError("Cannot connect to server.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (forgotPassword.length < 6) return setForgotError("Password must be at least 6 characters.");
    if (forgotPassword !== forgotConfirm) return setForgotError("Passwords do not match.");
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken: forgotToken, password: forgotPassword }),
      });
      const data = await res.json();
      if (!res.ok) return setForgotError(data.error || "Failed to reset password.");
      setForgotStep("done");
    } catch {
      setForgotError("Cannot connect to server.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
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
            <h1 className="text-2xl font-bold text-primary">Documents Tracking System</h1>
          </div>
          <p className="text-gray-600">Municipal Planning and Development Office</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-600 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@alubijid.gov.ph"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openForgot}
                className="text-sm text-primary hover:text-primary/80 font-medium transition"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 mt-6"
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:text-primary/80 transition">
              Sign Up
            </Link>
          </p>
        </div>

        {/* Demo Info */}
        <div className="mt-8 space-y-4">
          {/* Admin Credentials */}
          <div className="bg-white rounded-xl p-6 border-2 border-secondary/30">
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-semibold text-secondary">Admin Account:</span>
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                Email: <code className="bg-gray-100 px-2 py-1 rounded">demo@alubijid.gov.ph</code>
              </li>
              <li>
                Password: <code className="bg-gray-100 px-2 py-1 rounded">demo123</code>
              </li>
            </ul>
          </div>

          {/* Staff Credentials */}
          <div className="bg-white rounded-xl p-6 border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-semibold text-blue-600">Staff Account:</span>
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                Email: <code className="bg-gray-100 px-2 py-1 rounded">staff@alubijid.gov.ph</code>
              </li>
              <li>
                Password: <code className="bg-gray-100 px-2 py-1 rounded">staff123</code>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold">Reset Password</h3>
              <p className="text-white/80 text-sm mt-1">
                {forgotStep === "email" && "Enter your personal email address"}
                {forgotStep === "otp" && "Enter the OTP sent to your email"}
                {forgotStep === "password" && "Set your new password"}
                {forgotStep === "done" && "Password reset successful"}
              </p>
              {/* Step indicator */}
              {forgotStep !== "done" && (
                <div className="flex items-center gap-2 mt-4">
                  {(["email", "otp", "password"] as const).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                        ${forgotStep === s ? "bg-white text-primary border-white" :
                          ["email", "otp", "password"].indexOf(forgotStep) > i
                            ? "bg-white/30 border-white/60 text-white"
                            : "bg-white/10 border-white/30 text-white/50"}`}>
                        {i + 1}
                      </div>
                      {i < 2 && <div className={`h-0.5 w-8 ${["email", "otp", "password"].indexOf(forgotStep) > i ? "bg-white/60" : "bg-white/20"}`} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 space-y-4">
              {forgotError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{forgotError}</p>
                </div>
              )}

              {/* Step 1 — Email */}
              {forgotStep === "email" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Personal Email</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                      placeholder="yourname@gmail.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">Enter the personal email you registered with your account. The OTP will be sent there.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>Cancel</Button>
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90 text-white"
                      onClick={handleSendOtp}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Sending..." : "Send OTP"}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2 — OTP */}
              {forgotStep === "otp" && (
                <>
                  {devOtp && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                      <span className="text-yellow-600 text-lg">⚠</span>
                      <div>
                        <p className="text-yellow-800 text-sm font-semibold">Development Mode — No email configured</p>
                        <p className="text-yellow-700 text-sm mt-0.5">Your OTP is: <span className="font-mono font-bold text-lg tracking-widest">{devOtp}</span></p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">One-Time Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        placeholder="6-digit code"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary tracking-widest text-center text-lg font-semibold"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">OTP sent to <span className="font-medium">{forgotEmail}</span>. Valid for 10 minutes.</p>
                    <button
                      type="button"
                      onClick={() => { setForgotStep("email"); setForgotOtp(""); setForgotError(""); }}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      Wrong email? Go back
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>Cancel</Button>
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90 text-white"
                      onClick={handleVerifyOtp}
                      disabled={forgotLoading || forgotOtp.length < 6}
                    >
                      {forgotLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3 — New password */}
              {forgotStep === "password" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showForgotPassword ? "text" : "password"}
                        value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowForgotPassword(!showForgotPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showForgotPassword ? "text" : "password"}
                        value={forgotConfirm}
                        onChange={(e) => setForgotConfirm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>Cancel</Button>
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90 text-white"
                      onClick={handleResetPassword}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Resetting..." : "Reset Password"}
                    </Button>
                  </div>
                </>
              )}

              {/* Done */}
              {forgotStep === "done" && (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h4>
                  <p className="text-gray-600 mb-6">Your password has been updated successfully. You can now sign in with your new password.</p>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    onClick={() => setShowForgot(false)}
                  >
                    Back to Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
