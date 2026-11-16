import { useState, useEffect, useRef } from 'react';
import { generateQRCodeSVG } from '../utils/qrGenerator';
import { useNavigate } from 'react-router-dom';

export default function QRRoomModal({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('my-code'); // 'my-code' or 'scan'
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  const currentUserId = user?.userId || user?.id || 'guest';
  const username = user?.username || 'user';
  const roomUrl = `${window.location.origin}/chat/new?ref=${encodeURIComponent(username)}`;

  // Generate SVG QR Code
  const qrSvg = generateQRCodeSVG(roomUrl, 240);

  const handleCopy = () => {
    navigator.clipboard?.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Camera BarcodeDetector Scanner
  useEffect(() => {
    let detector = null;
    let scanInterval = null;
    let isCancelled = false;

    if (activeTab === 'scan') {
      const initCamera = async () => {
        try {
          setScanError('');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (isCancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          if ('BarcodeDetector' in window) {
            detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            scanInterval = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    const found = barcodes[0].rawValue;
                    handleScannedResult(found);
                  }
                } catch (e) {}
              }
            }, 400);
          }
        } catch (err) {
          setScanError('Camera permission required to scan QR codes. You can also enter the code manually below.');
        }
      };

      initCamera();
    }

    return () => {
      isCancelled = true;
      if (scanInterval) clearInterval(scanInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeTab]);

  const handleScannedResult = (val) => {
    if (!val) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (val.includes('/chat/')) {
        const path = val.replace(window.location.origin, '');
        onClose();
        navigate(path);
      } else {
        onClose();
        navigate(`/friends?search=${encodeURIComponent(val)}`);
      }
    } catch (e) {
      onClose();
    }
  };

  const handleManualJoin = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedResult(manualCode.trim());
  };

  return (
    <div className="unique-modal-backdrop" onClick={onClose}>
      <div className="unique-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="unique-modal-header">
          <div className="unique-modal-title-row">
            <span className="unique-icon-badge qr-badge">
              <i className="fa-solid fa-qrcode" />
            </span>
            <div>
              <h2 className="unique-modal-title">QR Conversation Room</h2>
              <p className="unique-modal-sub">Scan or share to chat with instant auto-translation</p>
            </div>
          </div>
          <button type="button" className="unique-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="unique-tabs-row">
          <button
            type="button"
            className={`unique-tab-btn ${activeTab === 'my-code' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-code')}
          >
            <i className="fa-solid fa-id-badge" />
            <span>My QR Code</span>
          </button>
          <button
            type="button"
            className={`unique-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            <i className="fa-solid fa-camera" />
            <span>Scan Room QR</span>
          </button>
        </div>

        {/* My QR Code Tab */}
        {activeTab === 'my-code' && (
          <div className="qr-code-body">
            <div className="qr-frame" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="qr-user-badge">
              <i className="fa-solid fa-circle-check text-green" />
              <span>@{username}</span>
              <span className="qr-lang-tag">Auto-Translate Enabled</span>
            </div>
            <p className="qr-instructions">
              Anyone scanning this QR with Giochat or phone camera will immediately join a translated room with you!
            </p>
            <div className="qr-actions">
              <button type="button" className="qr-action-btn primary" onClick={handleCopy}>
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-link'}`} />
                <span>{copied ? 'Link Copied!' : 'Copy Room Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scan QR Tab */}
        {activeTab === 'scan' && (
          <div className="qr-scan-body">
            <div className="qr-scanner-viewport">
              <video ref={videoRef} playsInline muted className="qr-video-feed" />
              <div className="qr-reticle">
                <span className="reticle-corner tl" />
                <span className="reticle-corner tr" />
                <span className="reticle-corner bl" />
                <span className="reticle-corner br" />
                <div className="reticle-laser" />
              </div>
            </div>

            {scanError && <p className="qr-scan-warning">{scanError}</p>}

            <form onSubmit={handleManualJoin} className="qr-manual-form">
              <input
                type="text"
                placeholder="Or type room code / username..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="qr-manual-input"
              />
              <button type="submit" className="qr-manual-btn" disabled={!manualCode.trim()}>
                Join
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
