import { useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useDispatch } from 'react-redux';
import { addMessage, setConversations } from './store/slices/chatSlice';
import { getMyConversations } from './api/conversationApi';
import api from './api/axios';
// import { usePresenceSocket } from './hooks/usePresenceSocket'; // <-- comment this
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import FriendsList from './pages/FriendsList';
import Chat from './pages/Chat';
import Calls from './pages/Calls';
import Settings from './pages/Settings';
import CommunityHome from './pages/CommunityHome';
import Footer from './components/Footer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { LanguageProvider } from './contexts/LanguageContext';
import { useIncomingCallNotifications } from './hooks/useIncomingCallNotifications';
import IncomingCallPopup from './components/IncomingCallPopup';
import TopNotificationToast from './components/TopNotificationToast';

function RequireAuth({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function IncomingCallManager({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const handleMessage = useCallback((message) => {
    if (String(message.senderId) !== String(user?.userId)) {
      dispatch(addMessage({ conversationId: message.conversationId, message }));
    }
  }, [dispatch, user?.userId]);
  const { incomingCall, dismissCall, declineCall } = useIncomingCallNotifications(user?.userId, handleMessage);

  useEffect(() => {
    if (!user) return;
    getMyConversations().then((conversations) => dispatch(setConversations(conversations))).catch(() => {});
  }, [dispatch, user]);
  const isCallChatOpen = incomingCall && location.pathname === `/chat/${incomingCall.conversationId}`;

  if (!incomingCall || isCallChatOpen) return null;

  const acceptCall = () => {
    navigate(`/chat/${incomingCall.conversationId}`, {
      state: { friend: incomingCall.friend, incomingCall, autoAccept: true },
    });
    dismissCall();
  };

  return <IncomingCallPopup call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />;
}

export default function App() {
  const { user, loginUser, logout, updateStoredUser, isAuthenticated } = useAuth();
  const location = useLocation();
  const isChatOpen = location.pathname.startsWith('/chat/');

  // Pre-warm backend on initial mount (wakes up Render free instance)
  useEffect(() => {
    api.get('/auth/health').catch(() => {});
  }, []);

  // Sync mobile chat state with body to optimize mobile full-height experience
  useEffect(() => {
    if (isChatOpen) {
      document.body.classList.add('is-chat-active');
    } else {
      document.body.classList.remove('is-chat-active');
    }
    return () => {
      document.body.classList.remove('is-chat-active');
    };
  }, [isChatOpen]);

  return (
    <LanguageProvider>
      <div className={`app-shell ${isChatOpen ? 'is-chat-active' : ''} ${isAuthenticated ? 'is-authenticated' : ''}`}>
        <Navbar user={user} onLogout={logout} isChatOpen={isChatOpen} />
        <TopNotificationToast />
        <IncomingCallManager user={user} />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <Login onLogin={loginUser} />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/home" replace /> : <Register onLogin={loginUser} />} />
            <Route path="/home" element={<RequireAuth isAuthenticated={isAuthenticated}><CommunityHome user={user} /></RequireAuth>} />
            <Route path="/feed" element={<RequireAuth isAuthenticated={isAuthenticated}><CommunityHome user={user} /></RequireAuth>} />
            <Route path="/friends" element={<RequireAuth isAuthenticated={isAuthenticated}><FriendsList /></RequireAuth>} />
            <Route path="/calls" element={<RequireAuth isAuthenticated={isAuthenticated}><Calls currentUserId={user?.userId || user?.id} /></RequireAuth>} />
            <Route path="/chat/:conversationId" element={<RequireAuth isAuthenticated={isAuthenticated}><Chat currentUserId={user?.userId || user?.id} currentUser={user} /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth isAuthenticated={isAuthenticated}><Settings user={user} onProfileUpdate={updateStoredUser} /></RequireAuth>} />
            <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
          </Routes>
        </main>
        {isAuthenticated && <MobileBottomNav user={user} onLogout={logout} />}
        <Footer />
        <PWAInstallPrompt />
      </div>
    </LanguageProvider>
  );
}