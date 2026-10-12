import { useMemo } from 'react';

export function evaluatePasswordStrength(password = '', username = '') {
  const p = password || '';
  const checks = {
    length: p.length >= 8,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~`]/.test(p),
    notUsername: !username || !p.toLowerCase().includes(username.toLowerCase().trim()),
  };

  const passedCount = [
    checks.length,
    checks.uppercase,
    checks.lowercase,
    checks.number,
    checks.special,
  ].filter(Boolean).length;

  let score = 0;
  let label = 'Very Weak';
  let color = '#ef4444'; // Red

  if (!p) {
    score = 0;
    label = 'Too Short';
    color = '#64748b';
  } else if (passedCount <= 2) {
    score = 1;
    label = 'Weak';
    color = '#ef4444';
  } else if (passedCount === 3) {
    score = 2;
    label = 'Fair';
    color = '#f97316'; // Orange
  } else if (passedCount === 4) {
    score = 3;
    label = 'Good';
    color = '#f59e0b'; // Amber
  } else if (passedCount === 5) {
    score = 4;
    label = 'Strong & Secure';
    color = '#10b981'; // Emerald Green
  }

  const isStrong = passedCount === 5 && checks.notUsername;

  return {
    score,
    passedCount,
    label,
    color,
    checks,
    isStrong,
  };
}

export default function PasswordStrengthMeter({ password = '', username = '', showChecklist = true }) {
  const { score, label, color, checks } = useMemo(
    () => evaluatePasswordStrength(password, username),
    [password, username]
  );

  if (!password) {
    return (
      <div className="pwd-meter-container">
        <div className="pwd-meter-hint">
          <i className="fa-solid fa-shield-halved"></i>
          <span>Use at least 8 characters with letters, numbers & symbols to protect against hackers.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pwd-meter-container">
      {/* Strength Bar */}
      <div className="pwd-meter-header">
        <span className="pwd-meter-title">
          <i className="fa-solid fa-shield-halved" style={{ color }}></i> Password Strength:
        </span>
        <strong className="pwd-meter-label" style={{ color }}>
          {label}
        </strong>
      </div>

      <div className="pwd-meter-track">
        <div
          className="pwd-meter-bar"
          style={{
            width: `${(score / 4) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Checklist */}
      {showChecklist && (
        <ul className="pwd-checklist">
          <li className={checks.length ? 'checked' : 'unchecked'}>
            <i className={`fa-solid ${checks.length ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>At least 8 characters</span>
          </li>
          <li className={checks.uppercase ? 'checked' : 'unchecked'}>
            <i className={`fa-solid ${checks.uppercase ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>Uppercase letter (A-Z)</span>
          </li>
          <li className={checks.lowercase ? 'checked' : 'unchecked'}>
            <i className={`fa-solid ${checks.lowercase ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>Lowercase letter (a-z)</span>
          </li>
          <li className={checks.number ? 'checked' : 'unchecked'}>
            <i className={`fa-solid ${checks.number ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>Number (0-9)</span>
          </li>
          <li className={checks.special ? 'checked' : 'unchecked'}>
            <i className={`fa-solid ${checks.special ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>Special symbol (!@#$%^&*)</span>
          </li>
        </ul>
      )}
    </div>
  );
}

