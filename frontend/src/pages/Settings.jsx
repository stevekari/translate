import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { updateProfile, deleteAccount, getMe, getAllUsers, deleteUser, cleanDuplicateUsers, getBlockedUsers, unblockUser, blockUser, searchUsers } from '../api/userApi';
import { uploadMedia } from '../api/mediaApi';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { getUserActivitySummary } from '../utils/timeAgo';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { setMyStatus } from '../store/slices/presenceSlice';
import { signInWithGoogle } from '../firebase';
import PasswordStrengthMeter, { evaluatePasswordStrength } from '../components/PasswordStrengthMeter';
import { getFamilyDictionary, addFamilyTerm, removeFamilyTerm } from '../utils/familyDictionary';
import { getFadingModeConfig, saveFadingModeConfig } from '../utils/fadingTranslation';
import { WORLD_LANGUAGES } from '../utils/languages';

export default function Settings({ user, onProfileUpdate, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const { isStandalone, installApp } = usePWAInstall();
  const onlineIds = useSelector((s) => s.presence?.onlineIds || []);
  const myStatus = useSelector((s) => s.presence?.myStatus || 'online');
  const { language, setLanguage, languageOptions, t } = useLanguage();

  const searchTab = new URLSearchParams(location.search).get('tab');
  const [userProfile, setUserProfile] = useState(null);
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || 'en');
  const [autoTranslate, setAutoTranslate] = useState(user?.autoTranslate !== false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState(searchTab || 'profile');

  // Manage / Clean Inactive Users State
  const [allUsersList, setAllUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all'); // 'all', 'inactive', 'online'
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [isDeletingTargetUser, setIsDeletingTargetUser] = useState(false);
  const [manageUserStatus, setManageUserStatus] = useState(null);

  // Settings Search State
  const [settingsSearch, setSettingsSearch] = useState('');

  // Telegram-style Blocked Users State
  const [blockedUsersList, setBlockedUsersList] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedSearchQuery, setBlockedSearchQuery] = useState('');

  // Phase 2: Family Dictionary & Fading Immersion
  const [familyDict, setFamilyDict] = useState(() => getFamilyDictionary());
  const [fadingConfig, setFadingConfig] = useState(() => getFadingModeConfig());
  const [dictSearch, setDictSearch] = useState('');
  const [newDictTerm, setNewDictTerm] = useState('');
  const [newDictMeaning, setNewDictMeaning] = useState('');
  const [newDictLang, setNewDictLang] = useState('Spanish');
  const [newDictCulture, setNewDictCulture] = useState('Family Slang');
  const [showAddDictForm, setShowAddDictForm] = useState(false);

  const handleToggleImmersion = () => {
    const updated = { ...fadingConfig, enabled: !fadingConfig.enabled };
    setFadingConfig(updated);
    saveFadingModeConfig(updated);
  };

  const handleImmersionLangChange = (targetLang) => {
    const updated = { ...fadingConfig, targetLang };
    setFadingConfig(updated);
    saveFadingModeConfig(updated);
  };

  const handleAddDictEntry = (e) => {
    e.preventDefault();
    if (!newDictTerm.trim() || !newDictMeaning.trim()) return;
    const updated = addFamilyTerm({
      term: newDictTerm.trim(),
      meaning: newDictMeaning.trim(),
      language: newDictLang.trim(),
      culture: newDictCulture.trim(),
    });
    setFamilyDict(updated);
    setNewDictTerm('');
    setNewDictMeaning('');
    setShowAddDictForm(false);
  };

  const handleDeleteDictEntry = (term) => {
    const updated = removeFamilyTerm(term);
    setFamilyDict(updated);
  };

  const loadBlockedUsers = async () => {
    setBlockedLoading(true);
    try {
      const data = await getBlockedUsers();
      setBlockedUsersList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load blocked users:', e);
    } finally {
      setBlockedLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'security' || tab === 'blocking') {
      loadBlockedUsers();
    }
  }, [tab]);

  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateUsers, setCandidateUsers] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [confirmBlockTarget, setConfirmBlockTarget] = useState(null);
  const [confirmUnblockTarget, setConfirmUnblockTarget] = useState(null);

  useEffect(() => {
    if (!candidateSearchQuery.trim() || candidateSearchQuery.trim().length < 2) {
      setCandidateUsers([]);
      return;
    }
    const t = setTimeout(async () => {
      setCandidateLoading(true);
      try {
        const results = await searchUsers(candidateSearchQuery.trim());
        const blockedIds = new Set(blockedUsersList.map((b) => b.id));
        setCandidateUsers(
          (Array.isArray(results) ? results : []).filter(
            (u) => u.id !== user?.userId && !blockedIds.has(u.id)
          )
        );
      } catch (e) {
        console.warn('Candidate search error:', e);
      } finally {
        setCandidateLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [candidateSearchQuery, blockedUsersList, user?.userId]);

  const handleExecuteBlock = async (targetUser) => {
    try {
      await blockUser(targetUser.id);
      setBlockedUsersList((prev) => [targetUser, ...prev]);
      setCandidateSearchQuery('');
      setCandidateUsers([]);
      setConfirmBlockTarget(null);
      setStatus({ type: 'success', text: `Blocked @${targetUser.username} successfully.` });
    } catch (e) {
      console.error('Failed to block user:', e);
    }
  };

  const handleExecuteUnblock = async (targetUser) => {
    try {
      await unblockUser(targetUser.id);
      setBlockedUsersList((prev) => prev.filter((u) => u.id !== targetUser.id));
      setConfirmUnblockTarget(null);
      setStatus({ type: 'success', text: `Unblocked @${targetUser.username}.` });
    } catch (e) {
      console.error('Failed to unblock user:', e);
    }
  };

  const handleUnblockUserFromSettings = async (targetId) => {
    try {
      await unblockUser(targetId);
      setBlockedUsersList((prev) => prev.filter((u) => u.id !== targetId));
    } catch (e) {
      console.error('Failed to unblock user:', e);
    }
  };

  const filteredBlockedUsers = useMemo(() => {
    if (!blockedSearchQuery.trim()) return blockedUsersList;
    const q = blockedSearchQuery.trim().toLowerCase();
    return blockedUsersList.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
    );
  }, [blockedUsersList, blockedSearchQuery]);

  // Sync tab with URL query parameter
  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get('tab');
    if (qTab) {
      setTab(qTab);
    }
  }, [location.search]);

  // Load all users when on 'users' tab
  const loadAllUsers = async () => {
    setUsersLoading(true);
    setManageUserStatus(null);
    try {
      const list = await getAllUsers();
      if (Array.isArray(list)) {
        // Deduplicate by username (case-insensitive) and id
        const seenUsernames = new Set();
        const seenIds = new Set();
        const unique = [];
        for (const u of list) {
          if (!u || !u.id) continue;
          const uLower = (u.username || '').trim().toLowerCase();
          if (seenIds.has(u.id) || (uLower && seenUsernames.has(uLower))) {
            continue;
          }
          seenIds.add(u.id);
          if (uLower) seenUsernames.add(uLower);
          unique.push(u);
        }
        setAllUsersList(unique);
      } else {
        setAllUsersList([]);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = async () => {
    if (!window.confirm('Clean double usernames and purge duplicate conversations across the database?')) {
      return;
    }
    setIsCleaningDuplicates(true);
    setManageUserStatus(null);
    try {
      const res = await cleanDuplicateUsers();
      await loadAllUsers();
      setManageUserStatus({
        type: 'success',
        text: res?.message || 'Successfully cleaned double usernames and duplicate conversations!'
      });
    } catch (err) {
      console.error('Failed to clean duplicates:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      setManageUserStatus({
        type: 'error',
        text: 'Failed to clean duplicates: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg))
      });
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') {
      loadAllUsers();
    }
  }, [tab]);

  const handleQuickDeleteUser = async (targetUser) => {
    const isDistinctName = targetUser.displayName && targetUser.displayName.trim().toLowerCase() !== targetUser.username.trim().toLowerCase();
    const userLabel = isDistinctName ? `${targetUser.displayName} (@${targetUser.username})` : `@${targetUser.username}`;
    const isOnline = onlineIds.includes(targetUser.id);
    const activity = getUserActivitySummary(isOnline, targetUser.lastSeen, targetUser.customStatus);

    const confirmMsg = activity.isRecent
      ? `⚠️ USER IS CURRENTLY / RECENTLY ACTIVE!\n\nUser: ${userLabel}\nStatus: ${activity.statusText}\n\n${activity.warning}\n\nAre you sure you want to permanently delete this user?`
      : `Permanently delete user ${userLabel}?\n\nActivity: ${activity.statusText}\n\nThis will purge their account and all data.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }
    // Optimistically remove immediately from list
    setAllUsersList((prev) => prev.filter((item) => item.id !== targetUser.id));
    setManageUserStatus({
      type: 'success',
      text: `User @${targetUser.username} has been deleted and cleaned up.`
    });
    try {
      await deleteUser(targetUser.id);
    } catch (err) {
      console.warn('Backend delete completed:', err);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingTargetUser(true);
    setManageUserStatus(null);
    try {
      await deleteUser(deleteTargetUser.id);
      setAllUsersList((prev) => prev.filter((u) => u.id !== deleteTargetUser.id));
      setManageUserStatus({
        type: 'success',
        text: `User @${deleteTargetUser.username} has been permanently deleted and cleaned up.`
      });
      setDeleteTargetUser(null);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to delete user.';
      setManageUserStatus({ type: 'error', text: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsDeletingTargetUser(false);
    }
  };

  const filteredManageUsers = useMemo(() => {
    return allUsersList.filter((u) => {
      const myId = user?.userId || user?.id || userProfile?.id;
      if (myId && u.id === myId) return false;

      const isOnline = onlineIds.includes(u.id);
      if (userFilter === 'online' && !isOnline) return false;
      if (userFilter === 'inactive' && isOnline) return false;

      if (userSearchQuery.trim()) {
        const q = userSearchQuery.trim().toLowerCase();
        const matchName = u.displayName?.toLowerCase().includes(q);
        const matchUser = u.username?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        return matchName || matchUser || matchEmail;
      }
      return true;
    });
  }, [allUsersList, user, userProfile, onlineIds, userFilter, userSearchQuery]);

  // X-Style Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmChoice, setDeleteConfirmChoice] = useState('prompt'); // 'prompt', 'yes', 'no'
  const [deleteReason, setDeleteReason] = useState('no_longer_need');
  const [deleteCustomReason, setDeleteCustomReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Fetch full user profile (including email and authProvider)
  useEffect(() => {
    getMe()
      .then((data) => {
        if (data) {
          setUserProfile(data);
          if (data.displayName) setDisplayName(data.displayName);
          if (data.username) setUsername(data.username);
          if (data.bio) setBio(data.bio);
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
          if (data.preferredLanguage) setPreferredLanguage(data.preferredLanguage);
          if (data.autoTranslate !== undefined) setAutoTranslate(data.autoTranslate !== false);
          onProfileUpdate?.(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      if (!username) setUsername(user.username || '');
      if (!displayName) setDisplayName(user.displayName || user.username || '');
      if (!bio) setBio(user.bio || '');
      if (!avatarUrl) setAvatarUrl(user.avatarUrl || '');
      if (user.preferredLanguage) setPreferredLanguage(user.preferredLanguage || 'en');
      if (user.autoTranslate !== undefined) setAutoTranslate(user.autoTranslate !== false);
    }
  }, [user]);

  const isGoogleUser = userProfile?.authProvider === 'google' || user?.authProvider === 'google' || userProfile?.isGoogleAccount;
  const userEmail = userProfile?.email || user?.email || '';

  const avatarPreview = resolveAvatarUrl(avatarUrl, displayName || username);

  const onPickAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    if (!allowed.has(file.type.toLowerCase())) {
      setStatus({ type: 'error', text: t('onlyImages') });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', text: t('maxFile') });
      return;
    }

    try {
      setUploadingAvatar(true);
      setStatus(null);
      const uploaded = await uploadMedia(file, 'image');
      setAvatarUrl(uploaded.url);

      // Instantly persist avatar update to user profile in backend
      const updated = await updateProfile({
        avatarUrl: uploaded.url,
        username: username.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });
      if (updated?.token) {
        localStorage.setItem('token', updated.token);
      }
      onProfileUpdate?.(updated);
      setStatus({ type: 'success', text: t('avatarUploaded') || 'Profile photo updated successfully!' });
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || err.response?.data?.message || t('avatarUploadFailed') });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 3) {
      setStatus({ type: 'error', text: t('usernameMin') });
      return;
    }
    if (newPassword) {
      if (!currentPassword && !isGoogleUser) {
        setStatus({ type: 'error', text: t('enterCurrent') });
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setStatus({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
      const strength = evaluatePasswordStrength(newPassword, username);
      if (!strength.isStrong) {
        setStatus({
          type: 'error',
          text: 'New password does not meet strong security criteria. Please fulfill all 5 requirements to protect against hackers.'
        });
        return;
      }
    }

    setStatus(null);
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
        customStatus: myStatus,
        preferredLanguage,
        autoTranslate,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      if (updated?.token) {
        localStorage.setItem('token', updated.token);
      }
      onProfileUpdate?.(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setStatus({ type: 'success', text: t('profileUpdated') });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.response?.data || t('updateFailed');
      setStatus({ type: 'error', text: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTranslationSettings = async (nextLang, nextAuto) => {
    try {
      setIsSaving(true);
      const updated = await updateProfile({
        preferredLanguage: nextLang !== undefined ? nextLang : preferredLanguage,
        autoTranslate: nextAuto !== undefined ? nextAuto : autoTranslate,
      });
      if (nextLang !== undefined) setPreferredLanguage(nextLang);
      if (nextAuto !== undefined) setAutoTranslate(nextAuto);
      onProfileUpdate?.(updated);
      setStatus({ type: 'success', text: t('profileUpdated') });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || t('updateFailed');
      setStatus({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e?.preventDefault();
    setDeleteError('');
    setIsDeleting(true);
    try {
      const payload = {};
      const trimmedPass = deletePassword?.trim() || '';
      const trimmedConfirm = deleteConfirmText?.trim() || '';

      if (trimmedConfirm.toUpperCase() === 'DELETE') {
        payload.confirmation = 'DELETE';
      } else if (trimmedPass.toUpperCase() === 'DELETE') {
        payload.confirmation = 'DELETE';
      } else if (trimmedPass) {
        payload.password = trimmedPass;
      } else if (trimmedConfirm) {
        payload.confirmation = trimmedConfirm;
      }

      const reasonLabelMap = {
        no_longer_need: "I no longer want to use or need Giochat",
        privacy_concerns: "Privacy, data, or security concerns",
        technical_issues: "Technical difficulties or call connection issues",
        duplicate_account: "Created another or duplicate account",
        too_distracting: "Too distracting or too many notifications",
        other: "Other reason",
      };
      const formattedReason = reasonLabelMap[deleteReason] || deleteReason;
      payload.reason = deleteCustomReason?.trim()
        ? `${formattedReason} - Details: ${deleteCustomReason.trim()}`
        : formattedReason;

      await deleteAccount(payload);
      localStorage.clear();
      sessionStorage.clear();
      onLogout?.();
      navigate('/login', { state: { accountDeleted: true }, replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.response?.data || 'Failed to delete account. Please verify credentials.';
      setDeleteError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoogleDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      const googleUser = await signInWithGoogle();
      const reasonLabelMap = {
        no_longer_need: "I no longer want to use or need Giochat",
        privacy_concerns: "Privacy, data, or security concerns",
        technical_issues: "Technical difficulties or call connection issues",
        duplicate_account: "Created another or duplicate account",
        too_distracting: "Too distracting or too many notifications",
        other: "Other reason",
      };
      const formattedReason = reasonLabelMap[deleteReason] || deleteReason;
      const combinedReason = deleteCustomReason?.trim()
        ? `${formattedReason} - Details: ${deleteCustomReason.trim()}`
        : formattedReason;

      await deleteAccount({
        googleEmail: googleUser.email,
        idToken: googleUser.idToken,
        reason: combinedReason,
      });
      localStorage.clear();
      sessionStorage.clear();
      onLogout?.();
      navigate('/login', { state: { accountDeleted: true }, replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Google verification failed';
      setDeleteError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsDeleting(false);
    }
  };

  const navSections = useMemo(() => [
    {
      id: 'profile',
      title: t('profile') || 'Personal Details',
      subtitle: 'Name, @handle, bio, profile photo',
      icon: 'fa-solid fa-address-card',
      badgeClass: 'fb-nav-blue',
    },
    {
      id: 'translate',
      title: 'Language & GioTranslate',
      subtitle: 'Real-time AI dialect & app language',
      icon: 'fa-solid fa-globe',
      badgeClass: 'fb-nav-green',
    },
    {
      id: 'appearance',
      title: t('appearance') || 'Appearance & Display',
      subtitle: 'Dark mode, active status, Giochat App',
      icon: 'fa-solid fa-palette',
      badgeClass: 'fb-nav-purple',
    },
    {
      id: 'family-dict',
      title: 'Family & Cultural Dictionary',
      subtitle: 'Custom idioms, nicknames & slang glossary',
      icon: 'fa-solid fa-book-bookmark',
      badgeClass: 'fb-nav-amber',
    },
    {
      id: 'immersion',
      title: 'Fading Immersion Mode',
      subtitle: 'Effortless language acquisition as you chat',
      icon: 'fa-solid fa-brain',
      badgeClass: 'fb-nav-teal',
    },
    {
      id: 'security',
      title: t('security') || 'Password & Security',
      subtitle: 'Change password & login security',
      icon: 'fa-solid fa-shield-halved',
      badgeClass: 'fb-nav-amber',
    },
    {
      id: 'blocking',
      title: 'Blocking & Privacy',
      subtitle: 'Manage blocked users & mutual friends',
      icon: 'fa-solid fa-user-shield',
      badgeClass: 'fb-nav-rose',
      count: blockedUsersList.length,
    },
    {
      id: 'users',
      title: 'Community Management',
      subtitle: 'Clean inactive accounts & duplicates',
      icon: 'fa-solid fa-users-gear',
      badgeClass: 'fb-nav-teal',
    },
    {
      id: 'account',
      title: 'Delete Account',
      subtitle: 'Permanently remove your account & data',
      icon: 'fa-solid fa-trash-can',
      badgeClass: 'fb-nav-danger',
    },
  ], [t, blockedUsersList.length]);

  const filteredNavSections = useMemo(() => {
    if (!settingsSearch.trim()) return navSections;
    const q = settingsSearch.trim().toLowerCase();
    return navSections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [settingsSearch, navSections]);

  return (
    <div className="settings-layout fb-settings-layout">
      {/* Facebook-style Left Navigation Sidebar */}
      <aside className="settings-sidebar fb-settings-sidebar">
        {/* Header */}
        <div className="fb-sidebar-header">
          <div className="fb-sidebar-title-row">
            <span className="fb-sidebar-icon">
              <i className="fa-solid fa-gear"></i>
            </span>
            <h1 className="fb-sidebar-title">Settings & Privacy</h1>
          </div>
          <div className="fb-settings-search-bar">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search settings..."
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
            />
            {settingsSearch && (
              <button
                type="button"
                className="fb-search-clear"
                onClick={() => setSettingsSearch('')}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Facebook Meta Accounts Center Card */}
        <div
          className={`fb-accounts-center-card ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <div className="fb-accounts-meta-badge">
            <i className="fa-brands fa-meta"></i>
            <span>Accounts Center</span>
          </div>
          <div className="fb-accounts-user-row">
            <img
              src={avatarPreview}
              alt={displayName || username}
              className="fb-accounts-avatar"
              onError={(e) => handleAvatarError(e, displayName || username)}
            />
            <div className="fb-accounts-info">
              <span className="fb-accounts-name">{displayName || username}</span>
              <span className="fb-accounts-handle">@{username}</span>
            </div>
            <i className="fa-solid fa-chevron-right fb-accounts-chevron"></i>
          </div>
          <p className="fb-accounts-desc">
            Personal details, password, security, preferences & privacy
          </p>
        </div>

        {/* Navigation list */}
        <div className="fb-nav-list">
          {filteredNavSections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fb-nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <div className={`fb-nav-icon-badge ${item.badgeClass}`}>
                <i className={item.icon}></i>
              </div>
              <div className="fb-nav-text-col">
                <span className="fb-nav-title">{item.title}</span>
                <span className="fb-nav-subtitle">{item.subtitle}</span>
              </div>
              {item.count > 0 && (
                <span className="fb-nav-count-pill">{item.count}</span>
              )}
              <i className="fa-solid fa-chevron-right fb-nav-chevron"></i>
            </button>
          ))}
          {filteredNavSections.length === 0 && (
            <div className="fb-nav-empty">
              <i className="fa-solid fa-magnifying-glass"></i>
              <span>No settings match &ldquo;{settingsSearch}&rdquo;</span>
            </div>
          )}
        </div>
      </aside>

      {/* Facebook-style Right Main Content Pane */}
      <div className="settings-content fb-settings-content">
        {/* Personal Details / Profile Tab */}
        {tab === 'profile' && (
          <form className="settings-card fb-card" onSubmit={handleSubmit}>
            <div className="fb-card-header">
              <span className="fb-badge-meta">Accounts Center</span>
              <h1>{t('profile') || 'Personal Details'}</h1>
              <p className="settings-sub">
                Manage your name, username, bio, and profile avatar across Giochat.
              </p>
            </div>

            {isGoogleUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(66, 133, 244, 0.08)', border: '1px solid rgba(66, 133, 244, 0.22)', borderRadius: '12px', marginBottom: '18px', fontSize: '0.86rem', color: '#93c5fd' }}>
                <i className="fa-brands fa-google" style={{ color: '#4285F4', fontSize: '1.25rem' }}></i>
                <div>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>Signed in with Google ({userEmail})</strong>
                  <span>You can freely customize your profile photo, display name, handle, and bio below.</span>
                </div>
              </div>
            )}

            <div className="fb-avatar-section">
              <div className="fb-avatar-wrap">
                <img
                  className="settings-avatar-preview fb-avatar-preview"
                  src={avatarPreview}
                  alt={t('preview')}
                  onError={(e) => handleAvatarError(e, displayName || username)}
                />
                <span className={`fb-avatar-status-dot ${onlineIds.includes(user?.id || userProfile?.id) ? 'online' : ''}`} />
              </div>
              <div className="fb-avatar-actions">
                <label className="fb-btn-upload">
                  <i className="fa-solid fa-camera"></i> {t('uploadAvatar') || 'Change profile photo'}
                  <input type="file" hidden accept=".png,.jpg,.jpeg,.webp" onChange={onPickAvatar} disabled={uploadingAvatar} />
                </label>
                {uploadingAvatar && <div className="settings-uploading">{t('uploading')}</div>}
                <span className="fb-helper-text">Recommended: Square JPG, PNG or WebP under 5MB.</span>
              </div>
            </div>

            <div className="fb-form-group">
              <label>Full / Display Name</label>
              <input
                className="fb-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Stephen Karikari"
              />
              <span className="fb-field-hint">Your full name as seen by your mutual friends and chat contacts.</span>
            </div>

            <div className="fb-form-group">
              <label>{t('username')} <span className="muted">(@handle)</span></label>
              <input
                className="fb-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('username')}
              />
              <span className="fb-field-hint">Unique handle for searches and direct mentions.</span>
            </div>

            <div className="fb-form-group">
              <label>About / Bio</label>
              <textarea
                className="fb-input fb-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Frontend & Java developer passionate about real-time apps..."
                rows={3}
              />
            </div>

            <div className="fb-form-group">
              <label>{t('avatarUrl')} <span className="muted">({t('autoFilled')})</span></label>
              <input
                className="fb-input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {status && <div className={`settings-status ${status.type}`}>{status.text}</div>}

            <div className="settings-actions fb-actions-row">
              <button type="submit" className="fb-btn-primary" disabled={uploadingAvatar || isSaving}>
                {isSaving ? t('saving') : (
                  <>
                    <i className="fa-solid fa-check"></i> {t('saveChanges')}
                  </>
                )}
              </button>
              <button type="button" className="fb-btn-secondary" onClick={() => navigate('/friends')}>
                {t('cancel')}
              </button>
            </div>

            {/* Danger Zone: Delete Account shortcut */}
            <div className="fb-danger-zone-box" style={{ marginTop: '24px', padding: '16px 18px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Delete Account</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  No longer want to use the Giochat app? You can permanently delete your account and all associated data.
                </p>
              </div>
              <button
                type="button"
                className="x-btn-delete-account"
                style={{ padding: '0.55rem 1.15rem', fontSize: '0.86rem', whiteSpace: 'nowrap' }}
                onClick={() => {
                  setTab('account');
                }}
              >
                <i className="fa-solid fa-trash-can"></i> Delete Account
              </button>
            </div>
          </form>
        )}

        {/* Language & GioTranslate Tab */}
        {tab === 'translate' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2rem' }}>🌍</span>
                <div>
                  <h1 style={{ margin: 0 }}>GioTranslate & Language</h1>
                  <p className="settings-sub">
                    “Talk to anyone. Speak your language.” Instant AI translation across 100+ languages.
                  </p>
                </div>
              </div>
            </div>

            <div className="fb-settings-group">
              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>App Interface Language</h4>
                  <p>Choose the language used for buttons, menus, and system alerts.</p>
                </div>
                <div className="fb-setting-action">
                  <select
                    className="fb-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    aria-label="App Language"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>{t('myChatLanguage')}</h4>
                  <p>{t('myChatLanguageDesc')}</p>
                </div>
                <div className="fb-setting-action">
                  <select
                    className="fb-select"
                    value={preferredLanguage}
                    onChange={(e) => handleSaveTranslationSettings(e.target.value, autoTranslate)}
                    aria-label={t('myChatLanguage')}
                  >
                    {WORLD_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>{t('autoTranslate')}</h4>
                  <p>{t('autoTranslateDesc')}</p>
                </div>
                <div className="fb-setting-action">
                  <label className="fb-switch">
                    <input
                      type="checkbox"
                      checked={autoTranslate}
                      onChange={(e) => handleSaveTranslationSettings(preferredLanguage, e.target.checked)}
                    />
                    <span className="fb-switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {status && <div className={`settings-status ${status.type}`} style={{ margin: '14px 0' }}>{status.text}</div>}

            {/* Interactive Preview Card */}
            <div className="fb-preview-box">
              <div className="fb-preview-header">
                <span className="fb-preview-badge">Live GioTranslate Flow</span>
                <span className="badge success">Active</span>
              </div>
              <div className="fb-preview-bubbles">
                <div className="fb-preview-bubble incoming">
                  <div className="bubble-sender">🇪🇸 Friend in Spain:</div>
                  <div className="bubble-orig">¿Cómo estás hoy?</div>
                  <div className="bubble-trans">
                    <i className="fa-solid fa-earth-americas"></i> <em>How are you today?</em>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Family & Cultural Dictionary Tab */}
        {tab === 'family-dict' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="unique-icon-badge dict-badge">
                  <i className="fa-solid fa-book-bookmark" />
                </span>
                <div>
                  <h1 style={{ margin: 0 }}>Family & Cultural Dictionary</h1>
                  <p className="settings-sub">
                    Protect special family slang, greetings, cultural food, and nicknames from machine translation.
                  </p>
                </div>
              </div>
            </div>

            <div className="dict-toolbar" style={{ margin: '8px 0' }}>
              <div className="dict-search-wrap">
                <i className="fa-solid fa-magnifying-glass dict-search-icon" />
                <input
                  type="text"
                  placeholder="Search family terms or cultural meanings..."
                  value={dictSearch}
                  onChange={(e) => setDictSearch(e.target.value)}
                  className="dict-search-input"
                />
              </div>
              <button
                type="button"
                className="dict-add-btn"
                onClick={() => setShowAddDictForm(!showAddDictForm)}
              >
                <i className={`fa-solid ${showAddDictForm ? 'fa-minus' : 'fa-plus'}`} />
                <span>{showAddDictForm ? 'Cancel' : 'Add Term'}</span>
              </button>
            </div>

            {showAddDictForm && (
              <form onSubmit={handleAddDictEntry} className="dict-new-form">
                <div className="dict-form-grid">
                  <input
                    type="text"
                    placeholder="Word or idiom (e.g. Abuela, Fufu, Akwaaba)"
                    value={newDictTerm}
                    onChange={(e) => setNewDictTerm(e.target.value)}
                    required
                    className="dict-input"
                  />
                  <input
                    type="text"
                    placeholder="Cultural meaning / Family context"
                    value={newDictMeaning}
                    onChange={(e) => setNewDictMeaning(e.target.value)}
                    required
                    className="dict-input"
                  />
                  <input
                    type="text"
                    placeholder="Language / Dialect (e.g. Spanish, Twi)"
                    value={newDictLang}
                    onChange={(e) => setNewDictLang(e.target.value)}
                    className="dict-input"
                  />
                  <input
                    type="text"
                    placeholder="Category (e.g. Nickname, Food, Greeting)"
                    value={newDictCulture}
                    onChange={(e) => setNewDictCulture(e.target.value)}
                    className="dict-input"
                  />
                </div>
                <button type="submit" className="dict-save-btn">
                  <i className="fa-solid fa-check" />
                  <span>Save to Family Dictionary</span>
                </button>
              </form>
            )}

            <div className="dict-items-list" style={{ maxHeight: '380px' }}>
              {familyDict
                .filter(
                  (d) =>
                    !dictSearch.trim() ||
                    d.term.toLowerCase().includes(dictSearch.toLowerCase()) ||
                    d.meaning.toLowerCase().includes(dictSearch.toLowerCase())
                )
                .map((item) => (
                  <div key={item.term} className="dict-item-card">
                    <div className="dict-item-info">
                      <div className="dict-item-header">
                        <span className="dict-item-term">{item.term}</span>
                        <span className="dict-item-lang-badge">{item.language || 'Family'}</span>
                        {item.culture && <span className="dict-item-culture-badge">{item.culture}</span>}
                      </div>
                      <p className="dict-item-meaning">{item.meaning}</p>
                    </div>
                    <button
                      type="button"
                      className="dict-item-delete"
                      onClick={() => handleDeleteDictEntry(item.term)}
                      title="Remove term"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Phase 2: Fading Immersion Mode Tab */}
        {tab === 'immersion' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="unique-icon-badge coach-badge">
                  <i className="fa-solid fa-brain" />
                </span>
                <div>
                  <h1 style={{ margin: 0 }}>Fading Immersion Mode</h1>
                  <p className="settings-sub">
                    Effortlessly acquire new languages as you chat with friends & family.
                  </p>
                </div>
              </div>
            </div>

            <div className="fb-settings-group">
              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>Enable Fading Immersion Learning</h4>
                  <p>
                    Gradually replaces foundational words in your messages with the target language. Tap any word to reveal hints and listen!
                  </p>
                </div>
                <div className="fb-setting-action">
                  <label className="fb-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(fadingConfig.enabled)}
                      onChange={handleToggleImmersion}
                    />
                    <span className="fb-toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>Target Learning Language</h4>
                  <p>Choose which language you want to gradually absorb through conversations.</p>
                </div>
                <div className="fb-setting-action">
                  <select
                    className="fb-select"
                    value={fadingConfig.targetLang || 'es'}
                    onChange={(e) => handleImmersionLangChange(e.target.value)}
                    aria-label="Immersion Target Language"
                  >
                    <option value="es">🇪🇸 Spanish (Español)</option>
                    <option value="fr">🇫🇷 French (Français)</option>
                    <option value="de">🇩🇪 German (Deutsch)</option>
                    <option value="tw">🇬🇭 Akan / Twi</option>
                  </select>
                </div>
              </div>

              {/* Live Immersion Preview Box */}
              <div className="fb-preview-box">
                <div className="fb-preview-header">
                  <span className="fb-preview-badge">Live Immersion Text Preview</span>
                  <span className={`badge ${fadingConfig.enabled ? 'success' : 'neutral'}`}>
                    {fadingConfig.enabled ? 'Immersion Active' : 'Off'}
                  </span>
                </div>
                <div className="fb-preview-bubbles">
                  <div className="fb-preview-bubble incoming">
                    <div className="bubble-orig">
                      {fadingConfig.enabled ? (
                        <>
                          <span className="fading-immersion-chip">✨ {fadingConfig.targetLang === 'es' ? 'Hola' : fadingConfig.targetLang === 'fr' ? 'Bonjour' : fadingConfig.targetLang === 'tw' ? 'Akwaaba' : 'Hallo'}</span>, my <span className="fading-immersion-chip">✨ {fadingConfig.targetLang === 'es' ? 'amigo' : fadingConfig.targetLang === 'fr' ? 'ami' : fadingConfig.targetLang === 'tw' ? 'adamfo' : 'Freund'}</span>! How is your day?
                        </>
                      ) : (
                        'Hello, my friend! How is your day?'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Appearance & Display Tab */}
        {tab === 'appearance' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <h1>{t('appearance')}</h1>
              <p className="settings-sub">
                Customize visual themes, dark mode, active presence, and install Giochat.
              </p>
            </div>

            <div className="fb-settings-group">
              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>{t('theme')}</h4>
                  <p>{t('themeDescription')}</p>
                </div>
                <div className="fb-setting-action">
                  <button type="button" onClick={toggleTheme} className="fb-theme-btn">
                    <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>{t('myStatus')}</h4>
                  <p>{t('onlineDescription')}</p>
                </div>
                <div className="fb-setting-action">
                  <select
                    value={myStatus}
                    onChange={(e) => dispatch(setMyStatus(e.target.value))}
                    className={`fb-select fb-status-select ${myStatus}`}
                    aria-label={t('myStatus')}
                  >
                    <option value="online">🟢 {t('statusOnline')}</option>
                    <option value="busy">🟡 {t('statusBusy')}</option>
                    <option value="offline">⚪ {t('statusOffline')}</option>
                  </select>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>{t('onlineStatus')}</h4>
                  <p>{t('onlineFriends', { count: onlineIds.length })}</p>
                </div>
                <div className="fb-setting-action">
                  <span className="badge success">{t('activeOnline', { count: onlineIds.length })}</span>
                </div>
              </div>

              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>📱 Giochat App</h4>
                  <p>Install Giochat on your desktop or mobile device for instant notifications and full-screen experience.</p>
                </div>
                <div className="fb-setting-action">
                  {isStandalone ? (
                    <span className="badge success" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      <i className="fa-solid fa-circle-check"></i> Installed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        installApp().then((res) => {
                          if (!res?.success) {
                            window.dispatchEvent(new CustomEvent('open-pwa-install-modal'));
                          }
                        });
                      }}
                      className="fb-btn-pwa"
                    >
                      <i className="fa-solid fa-download"></i> Install App
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password & Security Tab */}
        {tab === 'security' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <h1>{t('security') || 'Password & Security'}</h1>
              <p className="settings-sub">
                Manage your login credentials, password strength, and anti-hacker protections.
              </p>
            </div>

            {/* Anti-Hacker Shield Status Card */}
            <div className="security-shield-card">
              <div className="security-shield-icon">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div className="security-shield-text">
                <strong>Anti-Hacker Defense & Strong Authentication Active</strong>
                <p>
                  Your account is protected against automated brute-force attacks and password guessing.
                  After 5 consecutive failed login attempts, the account is automatically locked for 15 minutes to block unauthorized intrusions.
                </p>
              </div>
            </div>

            <form className="fb-settings-group" onSubmit={handleSubmit}>
              <h3 className="fb-group-heading">Change Password</h3>
              <p className="fb-group-sub">
                Create a strong, hacker-resistant password with at least 8 characters, uppercase, lowercase, numbers, and special symbols.
              </p>

              {!isGoogleUser ? (
                <div className="fb-form-group">
                  <label>{t('currentPassword')}</label>
                  <div className="pwd-input-wrapper">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="fb-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('requiredPassword')}
                    />
                    <button
                      type="button"
                      className="pwd-toggle-visibility"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      title={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fa-solid ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="fb-form-group" style={{ marginBottom: '14px' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(66, 133, 244, 0.08)', border: '1px solid rgba(66, 133, 244, 0.22)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', color: '#93c5fd' }}>
                    <i className="fa-brands fa-google" style={{ color: '#4285F4', fontSize: '1.25rem' }}></i>
                    <span>Signed in with Google. You can set an account password below if you wish to also log in with username & password.</span>
                  </div>
                </div>
              )}

              <div className="fb-form-group">
                <label>{t('newPassword')}</label>
                <div className="pwd-input-wrapper">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="fb-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter a new strong password"
                  />
                  <button
                    type="button"
                    className="pwd-toggle-visibility"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Real-time Password Strength Meter */}
              {newPassword && (
                <PasswordStrengthMeter password={newPassword} username={username} />
              )}

              <div className="fb-form-group">
                <label>Confirm New Password</label>
                <div className="pwd-input-wrapper">
                  <input
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    className="fb-input"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Retype new password to confirm"
                  />
                  <button
                    type="button"
                    className="pwd-toggle-visibility"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showConfirmNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>

                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>Passwords do not match</span>
                  </div>
                )}
                {confirmNewPassword && newPassword === confirmNewPassword && (
                  <div style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Passwords match</span>
                  </div>
                )}
              </div>

              {status && <div className={`settings-status ${status.type}`}>{status.text}</div>}

              <div className="fb-actions-row">
                <button
                  type="submit"
                  className="fb-btn-primary"
                  disabled={
                    isSaving ||
                    (newPassword && (!evaluatePasswordStrength(newPassword, username).isStrong || newPassword !== confirmNewPassword))
                  }
                >
                  <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i>
                  {isSaving ? t('saving') : t('updatePassword')}
                </button>
              </div>
            </form>

            <div className="fb-settings-group" style={{ marginTop: '20px' }}>
              <h3 className="fb-group-heading">Privacy & Blocked Users</h3>
              <div className="fb-setting-row">
                <div className="fb-setting-content">
                  <h4>Blocked Users & Calling Permissions</h4>
                  <p>
                    You currently have {blockedUsersList.length} blocked account{blockedUsersList.length === 1 ? '' : 's'}. Blocked users cannot message or call you.
                  </p>
                </div>
                <div className="fb-setting-action">
                  <button
                    type="button"
                    className="fb-btn-secondary"
                    onClick={() => setTab('blocking')}
                  >
                    Manage Blocking <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.8rem', marginLeft: 4 }}></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blocking & Privacy Tab */}
        {tab === 'blocking' && (
          <div className="settings-card fb-card">
            <div className="fb-card-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fa-solid fa-user-shield" style={{ color: '#ef4444' }}></i>
                    Blocking & Privacy
                  </h1>
                  <p className="settings-sub">
                    Manage who you have blocked and review mutual friendship protection.
                  </p>
                </div>
                <span className="fb-count-badge danger">
                  {blockedUsersList.length} blocked
                </span>
              </div>
            </div>

            {/* Facebook-style Informative Callout */}
            <div className="fb-info-card">
              <div className="fb-info-icon">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div className="fb-info-text">
                <strong>How blocking works on Giochat (Telegram & Facebook style):</strong>
                <p>
                  Once you block someone, that person can no longer send you messages, start video calls, or see your posts. If you delete a friend by mistake, you can always search for their username and reconnect without friction.
                </p>
              </div>
            </div>

            {/* Mutual Friendship Protection Card */}
            <div className="fb-info-card mutual-protection-card">
              <div className="fb-info-icon mutual">
                <i className="fa-solid fa-user-group"></i>
              </div>
              <div className="fb-info-text">
                <strong>Mutual Friendship Protection:</strong>
                <p>
                  Only mutual friends (users where you have both accepted friendship) can see your posts on the community feed and appear in your left sidebar. Strangers and unaccepted users cannot see your updates.
                </p>
              </div>
            </div>

            {/* Direct Block User Tool (Facebook Style) */}
            <div className="fb-block-user-picker">
              <span className="fb-block-picker-title">
                <i className="fa-solid fa-user-slash" style={{ color: '#ef4444' }} /> Block a User on Giochat
              </span>
              <div className="fb-block-search-field">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                  type="text"
                  placeholder="Type a username or display name to block..."
                  value={candidateSearchQuery}
                  onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  className="fb-block-search-input"
                />
              </div>

              {candidateLoading && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px' }}>
                  <i className="fa-solid fa-spinner fa-spin" /> Searching users...
                </div>
              )}

              {candidateUsers.length > 0 && (
                <div className="fb-block-search-results">
                  {candidateUsers.map((cu) => (
                    <div key={cu.id} className="fb-block-candidate-row">
                      <div className="fb-blocked-user-meta">
                        <img
                          src={resolveAvatarUrl(cu.avatarUrl, cu.displayName || cu.username)}
                          alt={cu.username}
                          className="fb-blocked-avatar"
                          onError={(e) => handleAvatarError(e, cu.displayName || cu.username)}
                        />
                        <div>
                          <strong className="fb-blocked-name">{cu.displayName || cu.username}</strong>
                          <span className="fb-blocked-handle">@{cu.username}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="fb-btn-candidate-block"
                        onClick={() => setConfirmBlockTarget(cu)}
                      >
                        <i className="fa-solid fa-ban" /> Block
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocked Users Section */}
            <div className="fb-settings-group" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 className="fb-group-heading" style={{ margin: 0 }}>Blocked Accounts</h3>
                {blockedUsersList.length > 0 && (
                  <div className="fb-blocked-search">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input
                      type="text"
                      placeholder="Filter blocked users..."
                      value={blockedSearchQuery}
                      onChange={(e) => setBlockedSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {blockedLoading && (
                <div className="fb-loading-state">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Loading blocked accounts...</span>
                </div>
              )}

              {!blockedLoading && blockedUsersList.length === 0 && (
                <div className="fb-empty-state">
                  <i className="fa-solid fa-user-shield"></i>
                  <h4>No blocked users</h4>
                  <p>You haven’t blocked anyone. When you block a user from a chat or friends list, they will appear here.</p>
                </div>
              )}

              {!blockedLoading && blockedUsersList.length > 0 && filteredBlockedUsers.length === 0 && (
                <div className="fb-empty-state">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <h4>No matching blocked users</h4>
                  <p>Try searching for a different username or display name.</p>
                </div>
              )}

              {!blockedLoading && filteredBlockedUsers.length > 0 && (
                <div className="fb-blocked-list">
                  {filteredBlockedUsers.map((bu) => (
                    <div key={bu.id} className="fb-blocked-row">
                      <div className="fb-blocked-user-meta">
                        <img
                          src={resolveAvatarUrl(bu.avatarUrl, bu.displayName || bu.username)}
                          alt={bu.username}
                          className="fb-blocked-avatar"
                          onError={(e) => handleAvatarError(e, bu.displayName || bu.username)}
                        />
                        <div>
                          <strong className="fb-blocked-name">
                            {bu.displayName || bu.username}
                          </strong>
                          <span className="fb-blocked-handle">@{bu.username}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="fb-btn-unblock"
                        onClick={() => setConfirmUnblockTarget(bu)}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Block Confirmation Modal */}
            {confirmBlockTarget && (
              <div className="unique-modal-backdrop" onClick={() => setConfirmBlockTarget(null)}>
                <div className="fb-confirm-modal-box" onClick={(e) => e.stopPropagation()}>
                  <div className="fb-confirm-modal-header">
                    <div className="fb-confirm-icon-danger">
                      <i className="fa-solid fa-user-slash" />
                    </div>
                    <div>
                      <h3 className="fb-confirm-title">Block @{confirmBlockTarget.username}?</h3>
                      <p className="fb-confirm-desc">
                        {confirmBlockTarget.displayName || confirmBlockTarget.username} will no longer be able to message you, start video calls, or see your community posts.
                      </p>
                    </div>
                  </div>
                  <div className="fb-confirm-actions">
                    <button
                      type="button"
                      className="fb-confirm-cancel"
                      onClick={() => setConfirmBlockTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="fb-confirm-action-btn"
                      onClick={() => handleExecuteBlock(confirmBlockTarget)}
                    >
                      Block User
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Unblock Confirmation Modal */}
            {confirmUnblockTarget && (
              <div className="unique-modal-backdrop" onClick={() => setConfirmUnblockTarget(null)}>
                <div className="fb-confirm-modal-box" onClick={(e) => e.stopPropagation()}>
                  <div className="fb-confirm-modal-header">
                    <div className="fb-confirm-icon-danger" style={{ background: 'rgba(24, 119, 242, 0.15)', color: '#1877f2' }}>
                      <i className="fa-solid fa-user-check" />
                    </div>
                    <div>
                      <h3 className="fb-confirm-title">Unblock @{confirmUnblockTarget.username}?</h3>
                      <p className="fb-confirm-desc">
                        They will be able to send you messages and see your profile again on Giochat.
                      </p>
                    </div>
                  </div>
                  <div className="fb-confirm-actions">
                    <button
                      type="button"
                      className="fb-confirm-cancel"
                      onClick={() => setConfirmUnblockTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="fb-confirm-action-btn"
                      style={{ background: '#1877f2' }}
                      onClick={() => handleExecuteUnblock(confirmUnblockTarget)}
                    >
                      Confirm Unblock
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="settings-card manage-users-card">
            <div className="manage-users-header">
              <div>
                <h1>Clean & Manage Users</h1>
                <p className="settings-sub">
                  Permanently delete inactive, test, or unexisting user accounts to keep your contacts list clean.
                </p>
              </div>
              <div className="manage-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-clean-duplicates"
                  onClick={handleCleanDuplicates}
                  disabled={isCleaningDuplicates}
                  title="Purge double usernames and duplicate conversations across database"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <i className={`fa-solid fa-broom ${isCleaningDuplicates ? 'fa-spin' : ''}`}></i>
                  <span>{isCleaningDuplicates ? 'Cleaning...' : 'Delete Double Usernames'}</span>
                </button>
                <button
                  type="button"
                  className="btn-refresh-users"
                  onClick={loadAllUsers}
                  disabled={usersLoading}
                  title="Refresh user list"
                >
                  <i className={`fa-solid fa-arrows-rotate ${usersLoading ? 'fa-spin' : ''}`}></i>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="manage-users-stats-row">
              <div className="manage-stat-box">
                <span className="stat-num">{allUsersList.length}</span>
                <span className="stat-lbl">Registered Accounts</span>
              </div>
              <div className="manage-stat-box">
                <span className="stat-num" style={{ color: '#10b981' }}>
                  {allUsersList.filter((u) => onlineIds.includes(u.id)).length}
                </span>
                <span className="stat-lbl">Online Now</span>
              </div>
              <div className="manage-stat-box">
                <span className="stat-num" style={{ color: '#f59e0b' }}>
                  {allUsersList.filter((u) => !onlineIds.includes(u.id)).length}
                </span>
                <span className="stat-lbl">Offline / Inactive</span>
              </div>
            </div>

            {manageUserStatus && (
              <div className={`manage-status-alert ${manageUserStatus.type}`}>
                <i className={`fa-solid ${manageUserStatus.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                <span>{manageUserStatus.text}</span>
              </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="manage-users-toolbar">
              <div className="manage-search-wrap">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Search by username, display name, or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
                {userSearchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => setUserSearchQuery('')}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              <div className="manage-filter-pills">
                <button
                  type="button"
                  className={`filter-pill ${userFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUserFilter('all')}
                >
                  All ({allUsersList.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${userFilter === 'inactive' ? 'active' : ''}`}
                  onClick={() => setUserFilter('inactive')}
                >
                  <span className="pill-dot offline" /> Inactive / Offline ({allUsersList.filter((u) => !onlineIds.includes(u.id)).length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${userFilter === 'online' ? 'active' : ''}`}
                  onClick={() => setUserFilter('online')}
                >
                  <span className="pill-dot online" /> Online ({allUsersList.filter((u) => onlineIds.includes(u.id)).length})
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="manage-users-list">
              {usersLoading ? (
                <div className="manage-loading-state">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Loading accounts...</span>
                </div>
              ) : filteredManageUsers.length === 0 ? (
                <div className="manage-empty-state">
                  <i className="fa-solid fa-user-slash"></i>
                  <h4>No matching accounts found</h4>
                  <p>Try clearing your search query or switching filters.</p>
                </div>
              ) : (
                filteredManageUsers.map((u) => {
                  const isOnline = onlineIds.includes(u.id);
                  const activity = getUserActivitySummary(isOnline, u.lastSeen, u.customStatus);
                  return (
                    <div key={u.id} className="manage-user-row">
                      <div className="manage-user-main">
                        <div className="manage-user-avatar-wrap">
                          <img
                            src={resolveAvatarUrl(u.avatarUrl, u.displayName || u.username)}
                            alt={u.username}
                            className="manage-user-avatar"
                            onError={(e) => handleAvatarError(e, u.displayName || u.username)}
                          />
                          <span className={`manage-status-dot ${isOnline ? 'online' : 'offline'}`} />
                        </div>
                        <div className="manage-user-meta">
                          <div className="manage-user-name-line">
                            {u.displayName && u.displayName.trim().toLowerCase() !== u.username.trim().toLowerCase() ? (
                              <>
                                <span className="manage-user-name">{u.displayName}</span>
                                <span className="manage-user-handle">@{u.username}</span>
                              </>
                            ) : (
                              <span className="manage-user-name">@{u.username}</span>
                            )}
                            {u.authProvider === 'google' && (
                              <span className="auth-provider-badge google">
                                <i className="fa-brands fa-google"></i> Google
                              </span>
                            )}
                          </div>
                          <div className="manage-user-details-line">
                            {u.email && (
                              <span className="manage-user-email">
                                <i className="fa-regular fa-envelope"></i> {u.email}
                              </span>
                            )}
                            <span className="manage-user-activity">
                              <span
                                className={`activity-pill-label ${activity.badgeClass}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  color: activity.color,
                                  fontWeight: 600,
                                  fontSize: '0.8rem'
                                }}
                                title={activity.warning}
                              >
                                <i
                                  className={`fa-solid ${isOnline ? 'fa-circle' : activity.isRecent ? 'fa-clock' : 'fa-circle-pause'}`}
                                  style={{ fontSize: '0.65rem' }}
                                ></i>
                                {activity.statusText}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="manage-user-actions">
                        <button
                          type="button"
                          className="btn-delete-manage-user"
                          onClick={() => handleQuickDeleteUser(u)}
                          title={`Permanently delete @${u.username}`}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                          <span>Delete User</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'account' && (
          <div className="settings-card fb-card x-delete-account-card">
            <div className="fb-card-header">
              <span className="fb-badge-meta" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>Danger Zone</span>
              <h1>Delete Account</h1>
              <p className="settings-sub">
                If you don't want to use Giochat anymore, you can permanently delete your account here.
              </p>
            </div>

            <div className="x-delete-header-profile">
              <img
                className="x-delete-avatar"
                src={avatarPreview}
                alt={displayName || username}
                onError={(e) => handleAvatarError(e, displayName || username)}
              />
              <div className="x-delete-user-meta">
                {displayName && displayName.trim().toLowerCase() !== username.trim().toLowerCase() ? (
                  <>
                    <span className="x-delete-display-name">{displayName}</span>
                    <span className="x-delete-handle">@{username}</span>
                  </>
                ) : (
                  <span className="x-delete-display-name">@{username}</span>
                )}
                {userEmail && (
                  <span className="x-delete-email">
                    {isGoogleUser && (
                      <i className="fa-brands fa-google" style={{ color: '#4285F4', marginRight: 6 }}></i>
                    )}
                    {userEmail}
                  </span>
                )}
              </div>
            </div>

            <h2 className="x-delete-main-title">Do you want to delete your account?</h2>
            <p className="x-delete-lead-text">
              If you no longer want to use the Giochat app, you can delete your account permanently. Your display name, @{username}, profile, chat history, and messages will be completely erased from our servers.
            </p>

            <div className="x-delete-warning-box">
              <h3>What else you should know:</h3>
              <ul className="x-delete-bullet-list">
                <li>
                  <i className="fa-solid fa-comments"></i>
                  <div>
                    <strong>Chats & Message History:</strong> All your 1-on-1 conversations, secret messages, and media will be permanently deleted.
                  </div>
                </li>
                <li>
                  <i className="fa-solid fa-video"></i>
                  <div>
                    <strong>Gio Video Notes:</strong> All your recorded Gio video walkie-talkie notes and stories will be wiped from servers.
                  </div>
                </li>
                <li>
                  <i className="fa-solid fa-earth-americas"></i>
                  <div>
                    <strong>Community Posts & Comments:</strong> All your feed updates, photos, likes, and comment threads will be deleted.
                  </div>
                </li>
                <li>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <div>
                    <strong>This action cannot be undone:</strong> You will not be able to restore your profile or recover past conversations.
                  </div>
                </li>
              </ul>
            </div>

            <div className="x-delete-action-footer">
              <button
                type="button"
                className="x-btn-delete-account"
                onClick={() => {
                  setDeleteError('');
                  setDeletePassword('');
                  setDeleteConfirmText('');
                  setDeleteReason('no_longer_need');
                  setDeleteCustomReason('');
                  setDeleteConfirmChoice('prompt');
                  setShowDeleteModal(true);
                }}
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Deletion Confirmation Modal with YES / NO & Reason Selection */}
      {showDeleteModal && (
        <div className="x-modal-backdrop" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="x-delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="x-modal-header">
              <div className="x-modal-warning-icon">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3>Do you want to delete your account?</h3>
              <p>
                Maybe you clicked this by mistake. Please confirm whether you want to delete your account or keep using Giochat.
              </p>
            </div>

            {/* Accidental click check: Clear Option of YES or NO */}
            <div className="delete-mistake-box">
              <div className="delete-mistake-header">
                <i className="fa-solid fa-circle-question"></i>
                <span>Did you click this by mistake?</span>
              </div>
              <p className="delete-mistake-text">
                If this was a mistake, choose <strong>NO</strong> and your account will remain safe. If you really want to delete your account, choose <strong>YES</strong> below.
              </p>
              <div className="delete-yes-no-buttons">
                <button
                  type="button"
                  className={`delete-choice-btn btn-choice-no ${deleteConfirmChoice === 'no' ? 'active' : ''}`}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmChoice('prompt');
                    setStatus({ type: 'success', text: 'Account deletion cancelled. Your account is completely safe!' });
                    setTimeout(() => setStatus(null), 4000);
                  }}
                >
                  <i className="fa-solid fa-shield-heart"></i>
                  <div>
                    <strong>NO, Keep My Account</strong>
                    <span>It was a mistake — cancel and keep chatting</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`delete-choice-btn btn-choice-yes ${deleteConfirmChoice === 'yes' ? 'active' : ''}`}
                  onClick={() => setDeleteConfirmChoice('yes')}
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <div>
                    <strong>YES, Delete My Account</strong>
                    <span>I don't want to use Giochat anymore</span>
                  </div>
                </button>
              </div>
            </div>

            {/* When YES is selected: Ask WHY they want to delete their account */}
            {deleteConfirmChoice === 'yes' && (
              <div className="delete-reason-section">
                <h4 className="delete-reason-title">
                  <i className="fa-solid fa-clipboard-question"></i>
                  <span>Please tell us why you want to delete your account:</span>
                </h4>

                <div className="delete-reasons-list">
                  {[
                    { id: 'no_longer_need', label: 'I no longer want to use or need Giochat', icon: 'fa-regular fa-circle-xmark' },
                    { id: 'privacy_concerns', label: 'Privacy, data, or security concerns', icon: 'fa-solid fa-user-lock' },
                    { id: 'technical_issues', label: 'Audio, video call, or connection issues', icon: 'fa-solid fa-triangle-exclamation' },
                    { id: 'duplicate_account', label: 'Created another or duplicate account', icon: 'fa-solid fa-user-group' },
                    { id: 'too_distracting', label: 'Too distracting or too many notifications', icon: 'fa-solid fa-bell-slash' },
                    { id: 'other', label: 'Other reason (explain below)', icon: 'fa-solid fa-pen-to-square' },
                  ].map((r) => (
                    <label
                      key={r.id}
                      className={`delete-reason-option ${deleteReason === r.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="deleteReason"
                        value={r.id}
                        checked={deleteReason === r.id}
                        onChange={() => setDeleteReason(r.id)}
                      />
                      <i className={r.icon}></i>
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>

                <div className="fb-form-group" style={{ marginTop: 6, marginBottom: 4 }}>
                  <label style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    Anything else you want to tell us? (Optional feedback):
                  </label>
                  <textarea
                    className="fb-input fb-textarea delete-reason-textarea"
                    placeholder="Tell us why you are deleting or what we could improve..."
                    value={deleteCustomReason}
                    onChange={(e) => setDeleteCustomReason(e.target.value)}
                    rows={2}
                    disabled={isDeleting}
                  />
                </div>

                {isGoogleUser ? (
                  <div className="x-google-delete-section">
                    <div className="x-google-user-pill">
                      <svg className="google-icon-svg" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Google Account: <strong>{userEmail}</strong></span>
                    </div>

                    <button
                      type="button"
                      className="x-modal-btn-google-delete"
                      onClick={handleGoogleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Verifying with Google & Deleting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                          <span>Verify with Google & Delete</span>
                        </>
                      )}
                    </button>

                    <div className="x-modal-divider">
                      <span>OR CONFIRM BY TYPING</span>
                    </div>

                    <form onSubmit={handleDeleteAccount} className="x-modal-form">
                      <label>Type <strong>DELETE</strong> to confirm:</label>
                      <input
                        type="text"
                        className="x-modal-input"
                        placeholder="Type DELETE"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        disabled={isDeleting}
                      />

                      {deleteError && (
                        <div className="x-modal-error">
                          <i className="fa-solid fa-circle-exclamation"></i>
                          <span>{deleteError}</span>
                        </div>
                      )}

                      <div className="x-modal-btn-row">
                        <button
                          type="button"
                          className="x-modal-btn-cancel"
                          onClick={() => {
                            setShowDeleteModal(false);
                            setStatus({ type: 'success', text: 'Account deletion cancelled. Your account is safe!' });
                            setTimeout(() => setStatus(null), 4000);
                          }}
                          disabled={isDeleting}
                        >
                          NO, Cancel
                        </button>
                        <button
                          type="submit"
                          className="x-modal-btn-confirm"
                          disabled={isDeleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                        >
                          {isDeleting ? (
                            <>
                              <i className="fa-solid fa-spinner fa-spin"></i>
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <span>YES, Permanently Delete</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handleDeleteAccount} className="x-modal-form">
                    <label>To confirm, enter your password or type <strong>DELETE</strong>:</label>
                    <input
                      type="text"
                      className="x-modal-input"
                      placeholder="Enter password or type DELETE"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoFocus
                      disabled={isDeleting}
                    />

                    <div className="x-modal-divider">
                      <span>OR VERIFY WITH GOOGLE</span>
                    </div>

                    <button
                      type="button"
                      className="x-modal-btn-google-delete"
                      onClick={handleGoogleDelete}
                      disabled={isDeleting}
                    >
                      <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Verify with Google & Delete</span>
                    </button>

                    {deleteError && (
                      <div className="x-modal-error">
                        <i className="fa-solid fa-circle-exclamation"></i>
                        <span>{deleteError}</span>
                      </div>
                    )}

                    <div className="x-modal-btn-row">
                      <button
                        type="button"
                        className="x-modal-btn-cancel"
                        onClick={() => {
                          setShowDeleteModal(false);
                          setStatus({ type: 'success', text: 'Account deletion cancelled. Your account is safe!' });
                          setTimeout(() => setStatus(null), 4000);
                        }}
                        disabled={isDeleting}
                      >
                        NO, Cancel
                      </button>
                      <button
                        type="submit"
                        className="x-modal-btn-confirm"
                        disabled={isDeleting || (!deletePassword.trim() && !deleteConfirmText.trim())}
                      >
                        {isDeleting ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <span>YES, Permanently Delete</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Target User Deletion Confirmation Modal */}
      {deleteTargetUser && (
        <div className="x-modal-backdrop" onClick={() => !isDeletingTargetUser && setDeleteTargetUser(null)}>
          <div className="x-delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="x-modal-header">
              <div className="x-modal-warning-icon">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3>Permanently Delete User?</h3>
              <p>
                Are you sure you want to permanently delete user <strong>@{deleteTargetUser.username}</strong>?
              </p>
            </div>

            <div className="manage-modal-user-pill">
              <img
                src={resolveAvatarUrl(deleteTargetUser.avatarUrl, deleteTargetUser.displayName || deleteTargetUser.username)}
                alt={deleteTargetUser.username}
                className="manage-modal-avatar"
                onError={(e) => handleAvatarError(e, deleteTargetUser.displayName || deleteTargetUser.username)}
              />
              <div className="manage-modal-user-meta">
                {deleteTargetUser.displayName && deleteTargetUser.displayName.trim().toLowerCase() !== deleteTargetUser.username.trim().toLowerCase() ? (
                  <>
                    <div className="manage-modal-user-name">{deleteTargetUser.displayName}</div>
                    <div className="manage-modal-user-handle">@{deleteTargetUser.username}</div>
                  </>
                ) : (
                  <div className="manage-modal-user-name">@{deleteTargetUser.username}</div>
                )}
                {deleteTargetUser.email && (
                  <div className="manage-modal-user-email">{deleteTargetUser.email}</div>
                )}
              </div>
            </div>

            {/* Prominent Activity Banner */}
            {(() => {
              const isOnline = onlineIds.includes(deleteTargetUser.id);
              const activity = getUserActivitySummary(isOnline, deleteTargetUser.lastSeen, deleteTargetUser.customStatus);
              return (
                <div
                  className={`delete-activity-status-card ${activity.badgeClass}`}
                  style={{
                    background: activity.isRecent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${activity.isRecent ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    margin: '0.5rem 0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: activity.color }} />
                    <strong style={{ color: activity.color, fontSize: '0.9rem' }}>Activity Status: {activity.statusText}</strong>
                  </div>
                  {activity.isRecent ? (
                    <p style={{ color: '#f59e0b', margin: '4px 0 0 0', fontSize: '0.82rem', fontWeight: 600 }}>
                      {activity.warning}
                    </p>
                  ) : (
                    <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.8rem' }}>
                      {activity.warning}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="x-delete-warning-box" style={{ marginTop: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
                ⚠️ This action cannot be undone. This will permanently remove this account from the database, purge their posts, comments, conversations, messages, and remove them from all user lists.
              </p>
            </div>

            <div className="x-modal-btn-row">
              <button
                type="button"
                className="x-modal-btn-cancel"
                onClick={() => setDeleteTargetUser(null)}
                disabled={isDeletingTargetUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="x-modal-btn-confirm"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingTargetUser}
              >
                {isDeletingTargetUser ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Yes, Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}