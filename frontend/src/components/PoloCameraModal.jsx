import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadMedia } from '../api/mediaApi';

export default function PoloCameraModal({ isOpen, onClose, onSend, friendName }) {
  const [mode, setMode] = useState('polo'); // 'photo' | 'polo' | 'voice'
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [recordTime, setRecordTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transcript, setTranscript] = useState('');

  const videoPreviewRef = useRef(null);
  const recordedVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Initialize Camera / Mic stream
  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const constraints = {
        video: mode !== 'voice' ? { facingMode, width: { ideal: 720 }, height: { ideal: 1280 } } : false,
        audio: true,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoPreviewRef.current && mode !== 'voice') {
        videoPreviewRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Unable to access camera or microphone. Please check permissions.');
    }
  }, [facingMode, mode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      resetState();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, startCamera]);

  const resetState = () => {
    setIsRecording(false);
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setCapturedPhoto(null);
    setRecordTime(0);
    setIsUploading(false);
    setErrorMsg(null);
    setTranscript('');
    if (timerRef.current) clearInterval(timerRef.current);
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Live speech-to-text during video recording
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentTranscript.trim());
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition start failed:', e);
      }
    }
  };

  const handleStartRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    setTranscript('');

    const mimeTypes = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    try {
      const options = selectedMime ? { mimeType: selectedMime } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: selectedMime || 'video/webm' });
        const url = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setRecordedUrl(url);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordTime(0);

      timerRef.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);

      startSpeechRecognition();
    } catch (err) {
      console.error('MediaRecorder start error:', err);
      setErrorMsg('Failed to record video note.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
    }
  };

  const handleTakePhoto = () => {
    if (!videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);
  };

  const handleSend = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      if (mode === 'photo' && capturedPhoto) {
        // Convert dataUrl to blob
        const res = await fetch(capturedPhoto);
        const blob = await res.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const uploadRes = await uploadMedia(file, 'image');
        const payload = JSON.stringify({
          type: 'image',
          mediaUrl: uploadRes.url,
          fileName: uploadRes.fileName,
          fileSize: uploadRes.fileSize,
        });
        onSend(payload);
        onClose();
      } else if (recordedBlob) {
        const file = new File([recordedBlob], `polo_${Date.now()}.webm`, { type: recordedBlob.type });
        const uploadRes = await uploadMedia(file, 'video');
        const payload = JSON.stringify({
          type: 'video',
          mediaUrl: uploadRes.url,
          durationSec: recordTime,
          transcript: transcript,
          fileName: uploadRes.fileName,
        });
        onSend(payload);
        onClose();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg('Failed to send video note. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPreviewing = Boolean(recordedUrl || capturedPhoto);

  return (
    <div className="polo-camera-overlay">
      <div className="polo-camera-container">
        {/* Top Controls Bar */}
        <div className="polo-top-bar">
          <button type="button" className="polo-top-btn" onClick={onClose} title="Close Camera">
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="polo-target-user">
            <span>To: <strong>{friendName || 'Chat'}</strong></span>
          </div>

          {!isPreviewing && mode !== 'voice' && (
            <button type="button" className="polo-top-btn" onClick={toggleFacingMode} title="Flip Camera">
              <i className="fa-solid fa-camera-rotate"></i>
            </button>
          )}
        </div>

        {/* Camera View / Video Preview */}
        <div className="polo-viewfinder">
          {errorMsg && (
            <div className="polo-error-banner">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {!isPreviewing ? (
            mode === 'voice' ? (
              <div className="polo-voice-placeholder">
                <i className="fa-solid fa-microphone polo-voice-large-icon"></i>
                <p>Voice Walkie-Talkie Note</p>
              </div>
            ) : (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`polo-live-video ${facingMode === 'user' ? 'mirror' : ''}`}
              />
            )
          ) : capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured" className="polo-preview-img" />
          ) : (
            <video
              ref={recordedVideoRef}
              src={recordedUrl}
              autoPlay
              controls
              playsInline
              className="polo-preview-video"
            />
          )}

          {/* Live Recording Overlay */}
          {isRecording && (
            <div className="polo-recording-badge">
              <span className="polo-rec-dot"></span>
              <span>{formatTime(recordTime)}</span>
            </div>
          )}

          {/* Live Speech Subtitle Preview */}
          {isRecording && transcript && (
            <div className="polo-live-subtitles">
              <p>{transcript}</p>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="polo-bottom-bar">
          {!isPreviewing ? (
            <>
              {/* Mode Switcher */}
              <div className="polo-mode-switcher">
                <button
                  type="button"
                  className={`polo-mode-tab ${mode === 'voice' ? 'active' : ''}`}
                  onClick={() => setMode('voice')}
                >
                  Voice
                </button>
                <button
                  type="button"
                  className={`polo-mode-tab ${mode === 'polo' ? 'active' : ''}`}
                  onClick={() => setMode('polo')}
                >
                  📹 Polo
                </button>
                <button
                  type="button"
                  className={`polo-mode-tab ${mode === 'photo' ? 'active' : ''}`}
                  onClick={() => setMode('photo')}
                >
                  Photo
                </button>
              </div>

              {/* Shutter / Record Button */}
              <div className="polo-shutter-wrap">
                {mode === 'photo' ? (
                  <button type="button" className="polo-shutter-btn photo-shutter" onClick={handleTakePhoto}>
                    <div className="shutter-inner"></div>
                  </button>
                ) : !isRecording ? (
                  <button type="button" className="polo-shutter-btn polo-record-start" onClick={handleStartRecording}>
                    <i className="fa-solid fa-video"></i>
                  </button>
                ) : (
                  <button type="button" className="polo-shutter-btn polo-record-stop" onClick={handleStopRecording}>
                    <div className="record-stop-square"></div>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Preview Action Buttons */
            <div className="polo-preview-actions">
              <button
                type="button"
                className="polo-retake-btn"
                onClick={resetState}
                disabled={isUploading}
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>Retake</span>
              </button>

              <button
                type="button"
                className="polo-send-btn"
                onClick={handleSend}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Polo</span>
                    <i className="fa-solid fa-paper-plane"></i>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
