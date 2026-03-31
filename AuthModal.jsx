import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import "./AuthModal.css";

const AuthModal = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const queryAuth = queryParams.get("auth");

  const [isPanelOpen, setIsPanelOpen] = useState(Boolean(queryAuth));
  const [activeTab, setActiveTab] = useState(queryAuth === "register" ? "register" : "login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginTouched, setLoginTouched] = useState({ email: false, password: false });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState("");
  const [regTouched, setRegTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    confirm: false,
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regBusy, setRegBusy] = useState(false);

  useEffect(() => {
    if (queryAuth === "login" || queryAuth === "register") {
      setActiveTab(queryAuth);
      setIsPanelOpen(true);
      return;
    }
    setIsPanelOpen(false);
  }, [queryAuth]);

  const clearAuthQuery = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has("auth")) return;
    params.delete("auth");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true }
    );
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    clearAuthQuery();
  };

  const validateEmail = (email) => /^[^\s@]+@(gmail\.com|yahoo\.com|google\.com)$/.test(email);
  const validatePassword = (password) =>
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,./<>?]/.test(password);

  const getLoginEmailError = (value) => {
    if (!value.trim()) return "Email is required";
    if (!validateEmail(value)) return "Enter a valid email (@gmail.com, @yahoo.com, @google.com)";
    return "";
  };
  const getLoginPasswordError = (value) => (!value ? "Password is required" : "");
  const getRegNameError = (value) => (!value.trim() ? "Full name is required" : "");
  const getRegEmailError = (value) => {
    if (!value.trim()) return "Email is required";
    if (!validateEmail(value)) return "Enter a valid email (@gmail.com, @yahoo.com, @google.com)";
    return "";
  };
  const getRegPasswordError = (value) => {
    if (!value) return "Password is required";
    if (!validatePassword(value)) {
      return "Password must be at least 8 characters with uppercase, lowercase, and special characters";
    }
    return "";
  };
  const getRegConfirmError = (passwordValue, confirmValue) => {
    if (!confirmValue) return "Confirm password is required";
    if (passwordValue !== confirmValue) return "Passwords do not match";
    return "";
  };

  const loginEmailError = getLoginEmailError(loginEmail);
  const loginPasswordError = getLoginPasswordError(loginPassword);
  const regNameError = getRegNameError(regName);
  const regEmailError = getRegEmailError(regEmail);
  const regPasswordError = getRegPasswordError(regPassword);
  const regConfirmError = getRegConfirmError(regPassword, regConfirm);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginTouched({ email: true, password: true });
    if (loginEmailError || loginPasswordError) return;

    try {
      setLoginBusy(true);
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      await user.reload();

      const userDocRef = doc(db, "users", user.uid);
      let userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data()?.disabled === true) {
        await signOut(auth);
        setLoginError("Your account has been disabled. Please contact an administrator.");
        return;
      }
      if (!user.emailVerified) {
        navigate("/verify-email");
        return;
      }
      if (!userSnap.exists()) {
        await setDoc(
          userDocRef,
          {
            fullName: "",
            email: user.email || loginEmail,
            birthdate: "",
            role: "user",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        userSnap = await getDoc(userDocRef);
      }

      let role = userSnap?.data()?.role;
      if (!role) {
        const arQ = query(collection(db, "accessRequests"), where("userId", "==", user.uid), limit(5));
        const arSnap = await getDocs(arQ);
        const approvedStaff = arSnap.docs.find((d) => {
          const data = d.data();
          return (
            data?.status === "approved" &&
            (data?.roleGranted === "staff" || data?.roleRequested === "staff")
          );
        });
        if (approvedStaff) {
          await setDoc(
            userDocRef,
            { role: "staff", updatedAt: serverTimestamp(), email: user.email || "" },
            { merge: true }
          );
          role = "staff";
        }
      }

      if (role === "admin") navigate("/admin");
      else if (role === "staff") navigate("/staff");
      else navigate("/dashboard");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        setLoginError("No user found with this email. Please register first.");
      } else if (error.code === "auth/wrong-password") {
        setLoginError("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-credential") {
        setLoginError("Invalid email or password. Please check and try again.");
      } else if (error.code === "auth/too-many-requests") {
        setLoginError("Too many login attempts. Please try again later.");
      } else {
        setLoginError(error?.message || "Login failed");
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError("");
    setRegTouched({ fullName: true, email: true, password: true, confirm: true });
    if (regNameError || regEmailError || regPasswordError || regConfirmError) return;

    try {
      setRegBusy(true);
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const newUser = userCredential.user;
      await setDoc(
        doc(db, "users", newUser.uid),
        {
          fullName: regName,
          email: regEmail,
          role: "user",
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await sendEmailVerification(newUser);
      navigate("/verify-email");
    } catch (error) {
      setRegError(error?.message || "Registration failed");
    } finally {
      setRegBusy(false);
    }
  };

  if (!isPanelOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={closePanel}>
      <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>

        {/* ── Left panel: floatpic ── */}
        <div className="auth-modal-left">
          <img
            src="/IMAGES/floatpic.png"
            alt="Welcome illustration"
            className="auth-modal-floatpic"
          />
        </div>

        {/* ── Right panel: forms (unchanged) ── */}
        <div className="auth-modal-right">
          <button className="auth-modal-close" onClick={closePanel} aria-label="Close">
            <FiX />
          </button>

          {/* Tab switcher */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${activeTab === "login" ? " auth-tab--active" : ""}`}
              onClick={() => setActiveTab("login")}
            >
              Login
            </button>
            <button
              className={`auth-tab${activeTab === "register" ? " auth-tab--active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              Register
            </button>
          </div>

          {/* ── Login form ── */}
          {activeTab === "login" && (
            <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="auth-field">
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onBlur={() => setLoginTouched((prev) => ({ ...prev, email: true }))}
                  className={loginTouched.email && loginEmailError ? "auth-input auth-input--error" : "auth-input"}
                />
                {loginTouched.email && loginEmailError && (
                  <span className="auth-error">{loginEmailError}</span>
                )}
              </div>

              <div className="auth-field auth-field--password">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onBlur={() => setLoginTouched((prev) => ({ ...prev, password: true }))}
                  className={loginTouched.password && loginPasswordError ? "auth-input auth-input--error" : "auth-input"}
                />
                <button
                  type="button"
                  className="auth-toggle-pw"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <FiEyeOff /> : <FiEye />}
                </button>
                {loginTouched.password && loginPasswordError && (
                  <span className="auth-error">{loginPasswordError}</span>
                )}
              </div>

              {loginError && <p className="auth-error auth-error--form">{loginError}</p>}

              <button type="submit" className="auth-submit" disabled={loginBusy}>
                {loginBusy ? "Logging in…" : "Login"}
              </button>
            </form>
          )}

          {/* ── Register form ── */}
          {activeTab === "register" && (
            <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
              <div className="auth-field">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  onBlur={() => setRegTouched((prev) => ({ ...prev, fullName: true }))}
                  className={regTouched.fullName && regNameError ? "auth-input auth-input--error" : "auth-input"}
                />
                {regTouched.fullName && regNameError && (
                  <span className="auth-error">{regNameError}</span>
                )}
              </div>

              <div className="auth-field">
                <input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  onBlur={() => setRegTouched((prev) => ({ ...prev, email: true }))}
                  className={regTouched.email && regEmailError ? "auth-input auth-input--error" : "auth-input"}
                />
                {regTouched.email && regEmailError && (
                  <span className="auth-error">{regEmailError}</span>
                )}
              </div>

              <div className="auth-field auth-field--password">
                <input
                  type={showRegPassword ? "text" : "password"}
                  placeholder="Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  onBlur={() => setRegTouched((prev) => ({ ...prev, password: true }))}
                  className={regTouched.password && regPasswordError ? "auth-input auth-input--error" : "auth-input"}
                />
                <button
                  type="button"
                  className="auth-toggle-pw"
                  onClick={() => setShowRegPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showRegPassword ? "Hide password" : "Show password"}
                >
                  {showRegPassword ? <FiEyeOff /> : <FiEye />}
                </button>
                {regTouched.password && regPasswordError && (
                  <span className="auth-error">{regPasswordError}</span>
                )}
              </div>

              <div className="auth-field auth-field--password">
                <input
                  type={showRegConfirm ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  onBlur={() => setRegTouched((prev) => ({ ...prev, confirm: true }))}
                  className={regTouched.confirm && regConfirmError ? "auth-input auth-input--error" : "auth-input"}
                />
                <button
                  type="button"
                  className="auth-toggle-pw"
                  onClick={() => setShowRegConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showRegConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showRegConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
                {regTouched.confirm && regConfirmError && (
                  <span className="auth-error">{regConfirmError}</span>
                )}
              </div>

              {regError && <p className="auth-error auth-error--form">{regError}</p>}

              <button type="submit" className="auth-submit" disabled={regBusy}>
                {regBusy ? "Registering…" : "Register"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
