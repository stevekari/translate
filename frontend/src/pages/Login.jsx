import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login } from '../api/authApi';
import { useLanguage } from '../contexts/LanguageContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import gcLogo from '../assets/gc.png';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, languageOptions, t } = useLanguage();
  const accountDeleted = location.state?.accountDeleted;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await login(username, password);
      const uId = response?.user?.id || response?.userId;
      if (uId) {
        localStorage.removeItem(`gio_welcome_seen_${uId}`);
        sessionStorage.setItem('just_logged_in', 'true');
      }
      onLogin(response);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data || t('loginFailed'));
    }
  };

  const handleGoogleSuccess = (response) => {
    const uId = response?.user?.id || response?.userId;
    if (uId) {
      localStorage.removeItem(`gio_welcome_seen_${uId}`);
      sessionStorage.setItem('just_logged_in', 'true');
    }
    onLogin(response);
    navigate('/home');
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <img src={gcLogo} alt="Giochat" className="auth-logo" />
          <h1>Welcome to Giochat 👋</h1>
          <p className="auth-sub">Connect, share your moments &amp; chat with friends worldwide</p>
        </div>

        {accountDeleted && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#10b981',
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '14px',
            fontSize: '0.88rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <i className="fa-solid fa-circle-check"></i>
            <span>Your account was deleted successfully.</span>
          </div>
        )}

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
          {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <label>{t('username')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          required
        />

        <label>{t('password')}</label>
        <div className="pwd-input-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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

        {error && (
          String(error).includes('Lockout') || String(error).includes('locked') || String(error).includes('hacker') ? (
            <div className="auth-lockout-banner">
              <i className="fa-solid fa-shield-halved"></i>
              <div>
                <strong>Hacker Defense Alert</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>{String(error)}</p>
              </div>
            </div>
          ) : (
            <div className="auth-error">{String(error)}</div>
          )
        )}

        <button type="submit">
          <i className="fa-solid fa-right-to-bracket" style={{ marginRight: 6 }}></i>
          {t('login')}
        </button>

        <p className="auth-switch">
         {t('noAccount')} <Link to="/register"> <span className='Register_C'>{t('register')}</span></Link>
        </p>
      </form>
    </div>
  );
}

