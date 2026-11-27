import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, checkDeletedAccount } from '../api/authApi';
import { uploadMedia } from '../api/mediaApi';
import { useLanguage } from '../contexts/LanguageContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PasswordStrengthMeter, { evaluatePasswordStrength } from '../components/PasswordStrengthMeter';
import gcLogo from '../assets/gc.png';

export default function Register({ onLogin }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [deletedAccountNotice, setDeletedAccountNotice] = useState(null);
  const navigate = useNavigate();
  const { language, setLanguage, languageOptions, t } = useLanguage();

  const strength = evaluatePasswordStrength(password, username, email);

  // Handle optional profile photo selection
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setIsUploadingPhoto(true);

    try {
      const res = await uploadMedia(file, 'image');
      if (res && res.url) {
        setAvatarUrl(res.url);
      }
    } catch (err) {
      console.warn('Photo upload error:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Detect in real-time if this person's email previously belonged to a deleted account
  useEffect(() => {
    if (!email || !email.includes('@') || email.trim().length < 5) {
      setDeletedAccountNotice(null);
      return;
    }

    const timer = setTimeout(() => {
      checkDeletedAccount(email.trim())
        .then((res) => {
          if (res?.previouslyDeleted) {
            setDeletedAccountNotice(res);
          } else {
            setDeletedAccountNotice(null);
          }
        })
        .catch(() => setDeletedAccountNotice(null));
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailPrefix = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    if (cleanEmail && (password.toLowerCase().includes(cleanEmail) || (emailPrefix.length >= 3 && password.toLowerCase().includes(emailPrefix)))) {
      setError('For your security, your password must NOT contain your email address or email name. Please create a unique password for Giochat.');
      return;
    }

    if (!strength.isStrong) {
      setError('Password is too weak. Please fulfill all security requirements to protect against hackers.');
      return;
    }

    try {
      const response = await register(username.trim(), email.trim(), password, name.trim(), avatarUrl || null);
      const uId = response?.user?.id || response?.userId;
      if (uId) {
        localStorage.removeItem(`gio_welcome_seen_${uId}`);
        sessionStorage.setItem('just_logged_in', 'true');
      }
      onLogin(response);

      if (response?.previouslyDeleted) {
        window.dispatchEvent(
          new CustomEvent('giochat-notification', {
            detail: {
              title: 'Welcome Back to Giochat! 🎉',
              content: response.welcomeBackMessage || 'We detected you previously had an account with us that was deleted. We are thrilled to welcome you back!',
              type: 'welcome',
            },
          })
        );
      }

      navigate('/home', {
        state: {
          returningUser: Boolean(response?.previouslyDeleted),
          welcomeMessage: response?.welcomeBackMessage,
        },
      });
    } catch (err) {
      const msg = err.response?.data || t('registrationFailed');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleGoogleSuccess = (response) => {
    const uId = response?.user?.id || response?.userId;
    if (uId) {
      localStorage.removeItem(`gio_welcome_seen_${uId}`);
      sessionStorage.setItem('just_logged_in', 'true');
    }
    onLogin(response);

    if (response?.previouslyDeleted) {
      window.dispatchEvent(
        new CustomEvent('giochat-notification', {
          detail: {
            title: 'Welcome Back to Giochat! 🎉',
            content: response.welcomeBackMessage || 'We detected you previously had an account with us that was deleted. We are thrilled to welcome you back!',
            type: 'welcome',
          },
        })
      );
    }

    navigate('/home', {
      state: {
        returningUser: Boolean(response?.previouslyDeleted),
        welcomeMessage: response?.welcomeBackMessage,
      },
    });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <img src={gcLogo} alt="Giochat" className="auth-logo" />
          <h1>Welcome to Giochat 👋</h1>
          <p className="auth-sub">Create your account • Connect &amp; share with friends worldwide</p>
        </div>

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={(errMsg) => setError(errMsg)}
          customPhotoUrl={avatarUrl}
        />

        <div className="auth-divider">
          <span>{t('or')}</span>
        </div>

        {/* Optional Profile Photo Picker (Works for both manual registration and Google) */}
        <div className="auth-avatar-picker-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
          <div
            className="auth-avatar-preview-box"
            onClick={() => fileInputRef.current?.click()}
            title="Click to choose a photo (Optional)"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile Preview" className="auth-avatar-img" />
            ) : (
              <div className="auth-avatar-empty">
                <i className="fa-solid fa-user"></i>
              </div>
            )}
            <div className="auth-avatar-camera-badge">
              <i className={isUploadingPhoto ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-camera'}></i>
            </div>
          </div>

          <div className="auth-avatar-meta">
            <span className="auth-avatar-label">
              Profile Photo <span className="auth-avatar-optional-tag">Optional</span>
            </span>
            <span className="auth-avatar-hint">
              {avatarPreview
                ? isUploadingPhoto
                  ? 'Uploading photo...'
                  : 'Photo added to your profile'
                : 'Upload your photo now or skip and add it later'}
            </span>
          </div>

          {avatarPreview && (
            <div className="auth-avatar-actions">
              <button
                type="button"
                className="auth-avatar-action-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Change Photo
              </button>
              <button
                type="button"
                className="auth-avatar-action-btn auth-avatar-remove-btn"
                onClick={handleRemovePhoto}
              >
                Remove
              </button>
            </div>
          )}
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

        <label>Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. John Doe"
          required
        />

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

        {/* Security protection alert: Warning not to use original email password */}
        <div className="auth-security-notice">
          <div className="auth-security-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div className="auth-security-content">
            <strong>Security Alert: Protect Your Account</strong>
            <p>
              Please create a <strong>new, unique password</strong> for Giochat. Do <strong>NOT</strong> enter your original personal email password (such as your Gmail, Outlook, or Yahoo password). A unique password prevents hackers from compromising your personal email.
            </p>
          </div>
        </div>

        {deletedAccountNotice && (
          <div className="auth-returning-banner">
            <div className="auth-returning-icon">
              <i className="fa-solid fa-rotate-left"></i>
            </div>
            <div className="auth-returning-content">
              <strong>Welcome back! We detected you previously had an account with this email.</strong>
              <p>
                {deletedAccountNotice.deletedAt
                  ? `An account with this email was deleted on ${new Date(deletedAccountNotice.deletedAt).toLocaleDateString()}. `
                  : ''}
                You can re-register anytime and start completely fresh!
              </p>
            </div>
          </div>
        )}

        <label>
          {t('password')} <span className="auth-pwd-subtitle">(New password for Giochat only)</span>
        </label>
        <div className="pwd-input-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong, unique password"
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
        <PasswordStrengthMeter password={password} username={username} email={email} />

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

