// components/AuthForm.tsx
import icon from "data-base64:~assets/user.svg"
import { useState } from "react"

import { supabase } from "../lib/supabase"

type Mode = "signin" | "signup" | "forgot"

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        setMessage("Signed in!")
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage("Account created! Please sign in.")
        setMode("signin")
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            "https://highlighter-extension-frontend.vercel.app/reset-password"
        })
        if (error) throw error
        setMessage("Password reset link sent! Check your email.")
        setTimeout(() => setMode("signin"), 3000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: "#edeef0",
        minHeight: "400px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
      <img
        src={icon}
        alt="Highlighter"
        style={{
          width: "30px",
          height: "30px",
          alignSelf: "center",
          alignItems: "center"
        }}
      />
      <h3
        style={{
          display: "grid",
          fontSize: "24px",
          minWidth: "300px",
          textAlign: "center",
          padding: "10px",
          margin: 0
        }}>
        {mode === "signin"
          ? "Welcome Back!"
          : mode === "signup"
            ? "Create an account"
            : "Reset Password"}
      </h3>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "12px" }}>
        <input
          type="email"
          value={email}
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            borderRadius: "8px",
            background: "#edeef0",
            border: "2px solid #ccc",
            fontSize: "14px",
            minWidth: "200px",
            padding: "10px"
          }}
        />
        {mode !== "forgot" && (
          <input
            type="password"
            value={password}
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              borderRadius: "8px",
              padding: "10px",
              border: "2px solid #ccc",
              fontSize: "14px",
              background: "#edeef0",
              minWidth: "200px"
            }}
          />
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            borderRadius: "8px",
            background: "#AC4BBF",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            minWidth: "200px",
            padding: "10px"
          }}>
          {loading
            ? "Please wait..."
            : mode === "signin"
              ? "Sign In"
              : mode === "signup"
                ? "Sign Up"
                : "Send Link"}
        </button>
      </form>

      <div style={{ marginTop: "12px", fontSize: "13px" }}>
        {mode === "signin" ? (
          <>
            <div>
              No account?{" "}
              <button
                onClick={() => setMode("signup")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#06f",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: "13px"
                }}>
                Sign up
              </button>
            </div>
            <div style={{ marginTop: "8px" }}>
              <button
                onClick={() => setMode("forgot")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#06f",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: "13px"
                }}>
                Forgot password?
              </button>
            </div>
          </>
        ) : mode === "signup" ? (
          <>
            Have an account?{" "}
            <button
              onClick={() => setMode("signin")}
              style={{
                background: "none",
                border: "none",
                color: "#06f",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                fontSize: "13px"
              }}>
              Sign in
            </button>
          </>
        ) : (
          <>
            Remember your password?{" "}
            <button
              onClick={() => setMode("signin")}
              style={{
                background: "none",
                border: "none",
                color: "#06f",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                fontSize: "13px"
              }}>
              Back to sign in
            </button>
          </>
        )}
      </div>

      {message && (
        <p style={{ color: "#10b981", marginTop: "12px", fontSize: "13px" }}>
          {message}
        </p>
      )}
      {error && (
        <p style={{ color: "#ef4444", marginTop: "12px", fontSize: "13px" }}>
          {error}
        </p>
      )}
    </div>
  )
}
