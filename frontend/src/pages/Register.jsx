import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/authApi';
import { useLanguage } from '../contexts/LanguageContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PasswordStrengthMeter, { evaluatePasswordStrength } from '../components/PasswordStrengthMeter';
import gcLogo from '../assets/gc.png';

export default function Register({ onLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { language, setLanguage, languageOptions, t } = useLanguage();

  const strength = evaluatePasswordStrength(password, username);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    if (!strength.isStrong) {
      setError('Password is too weak. Please fulfill all 5 security requirements to protect against hackers.');
      return;
    }

    try {
      const response = await register(username.trim(), email.trim(), password);
      onLogin(response);
      navigate('/friends');
    } catch (err) {
      const msg = err.response?.data || t('registrationFailed');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleGoogleSuccess = (response) => {
    onLogin(response);
    navigate('/friends');
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <img src={gcLogo} alt="Tranchat" className="auth-logo" />
          <h1>{t('createAccount')}</h1>
          <p className="auth-sub">Tranchat • Secure & Encrypted</p>
        </div>

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={(errMsg) => setError(errMsg)}
        />

        <div className="auth-divider">
          <span>{t('or')}</span>
        </div>

        <label htmlFor="language">{t('language')}</label>
        <select
          id="language"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
          }}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label>{t('username')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. john_doe"
          required
        />

        <label>{t('email')}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          required
        />

        <label>{t('password')}</label>
        <div className="pwd-input-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            required
          />
          <button
            type="button"
            className="pwd-toggle-visibility"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>

        {/* Real-time Password Strength Meter & Checklist */}
        <PasswordStrengthMeter password={password} username={username} />

        <label>Confirm Password</label>
        <div className="pwd-input-wrapper">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Retype password to confirm"
            required
          />
          <button
            type="button"
            className="pwd-toggle-visibility"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            title={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>

        {confirmPassword && password !== confirmPassword && (
          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Passwords do not match</span>
          </div>
        )}
        {confirmPassword && password === confirmPassword && (
          <div style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-circle-check"></i>
            <span>Passwords match</span>
          </div>
        )}

        {error && <div className="auth-error">{String(error)}</div>}

        <button type="submit" disabled={!strength.isStrong || password !== confirmPassword}>
          <i className="fa-solid fa-user-shield" style={{ marginRight: 6 }}></i>
          {t('register')}
        </button>

        <p className="auth-switch">
          {t('haveAccount')} <Link to="/login"> <span>{t('login')}</span></Link>
        </p>
      </form>
    </div>
  );
}

