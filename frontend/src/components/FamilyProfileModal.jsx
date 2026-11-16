import { useState, useEffect } from 'react';
import {
  FAMILY_ROLES,
  getFriendFamilyProfile,
  saveFriendFamilyProfile,
} from '../utils/familyProfiles';

export default function FamilyProfileModal({ friend, onClose, onSaved }) {
  const friendId = friend?.id || friend?.userId || friend?._id;
  const friendName = friend?.displayName || friend?.username || 'Contact';

  const [selectedRole, setSelectedRole] = useState('friend');
  const [formalityTone, setFormalityTone] = useState('Standard');
  const [customNote, setCustomNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const existing = getFriendFamilyProfile(friendId);
    if (existing) {
      if (existing.roleId) setSelectedRole(existing.roleId);
      if (existing.formalityTone) setFormalityTone(existing.formalityTone);
      if (existing.customNote) setCustomNote(existing.customNote);
    }
  }, [friendId]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role.id);
    if (role.tone) {
      setFormalityTone(role.tone);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const roleObj = FAMILY_ROLES.find((r) => r.id === selectedRole) || FAMILY_ROLES[0];
    const saved = saveFriendFamilyProfile(friendId, {
      roleId: selectedRole,
      roleLabel: roleObj.label,
      roleIcon: roleObj.icon,
      formalityTone,
      customNote: customNote.trim(),
    });

    setIsSaved(true);
    onSaved?.(saved);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="unique-modal-backdrop" onClick={onClose}>
      <div className="unique-modal-card profile-role-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="unique-modal-header">
          <div className="unique-modal-title-row">
            <span className="unique-icon-badge family-badge">
              <i className="fa-solid fa-people-roof" />
            </span>
            <div>
              <h2 className="unique-modal-title">Family Language Profile</h2>
              <p className="unique-modal-sub">Set familial role & cultural tone for {friendName}</p>
            </div>
          </div>
          <button type="button" className="unique-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSave} className="family-role-form">
          {/* Select Relationship Role */}
          <div className="role-section-label">Select Relationship:</div>
          <div className="role-options-grid">
            {FAMILY_ROLES.map((role) => {
              const active = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`role-option-btn ${active ? 'active' : ''}`}
                  onClick={() => handleRoleSelect(role)}
                >
                  <i className={`${role.icon} role-icon`} />
                  <span className="role-name">{role.label}</span>
                </button>
              );
            })}
          </div>

          {/* Formality Tone Preference */}
          <div className="role-section-label">Translation Tone & Respect Level:</div>
          <div className="tone-selector-row">
            {['Respectful / Formal', 'Standard', 'Informal / Playful'].map((tone) => (
              <button
                key={tone}
                type="button"
                className={`tone-pill-btn ${formalityTone === tone ? 'active' : ''}`}
                onClick={() => setFormalityTone(tone)}
              >
                {tone}
              </button>
            ))}
          </div>

          {/* Cultural Notes */}
          <div className="role-section-label">Personal Cultural Note (Optional):</div>
          <input
            type="text"
            placeholder="e.g. Speaks Asante Twi; loves polite greetings"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="role-note-input"
          />

          <button type="submit" className="role-save-btn">
            <i className={`fa-solid ${isSaved ? 'fa-check' : 'fa-floppy-disk'}`} />
            <span>{isSaved ? 'Saved!' : 'Save Family Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
