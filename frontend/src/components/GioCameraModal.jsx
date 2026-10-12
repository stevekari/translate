import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadMedia } from '../api/mediaApi';

export default function GioCameraModal({ isOpen, onClose, onSend, friendName }) {
  const [mode, setMode] = useState('gio'); // 'photo' | 'gio' | 'voice'
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

  // Start Real-time Speech-to-Text transcript while recording
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentTranscript.trim());
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition start error:', err);
      }
    }
  };

  const handleStartRecording = () => {
    if (!stream) return;
    setErrorMsg(null);
    chunksRef.current = [];
    setRecordTime(0);

    let mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
    }

    try {
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordTime((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      startSpeechRecognition();
    } catch (err) {
      console.error('MediaRecorder start error:', err);
      setErrorMsg('Failed to record Gio video note.');
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
        const file = new File([recordedBlob], `gio_${Date.now()}.webm`, { type: recordedBlob.type });
        const uploadRes = await uploadMedia(file, 'video');
        const payload = JSON.stringify({
          type: 'video',
          mediaUrl: uploadRes.url,
          durationSec: recordTime,
          transcript: transcript,
          fileName: uploadRes.fileName || 'Gio Video Note',
        });
        onSend(payload);
        onClose();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg('Failed to send Gio video note. Please try again.');
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
    <div className="polo-camera-overlay gio-camera-overlay">
      <div className="polo-camera-container gio-camera-container">
        {/* Top Controls Bar */}
        <div className="polo-top-bar gio-top-bar">
          <button type="button" className="polo-top-btn" onClick={onClose} title="Close Camera">
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="polo-target-user gio-target-user">
            <span>To: <strong>{friendName || 'Community'}</strong></span>
          </div>

          {!isPreviewing && mode !== 'voice' && (
            <button type="button" className="polo-top-btn" onClick={toggleFacingMode} title="Flip Camera">
              <i className="fa-solid fa-camera-rotate"></i>
            </button>
          )}
        </div>

        {/* Viewfinder View */}
        <div className="polo-viewfinder gio-viewfinder">
          {errorMsg && (
            <div className="polo-camera-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {!isPreviewing ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className={`polo-live-video ${facingMode === 'user' ? 'mirror' : ''}`}
            />
          ) : capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured preview" className="polo-preview-img" />
          ) : (
            <video
              ref={recordedVideoRef}
              src={recordedUrl}
              autoPlay
              loop
              playsInline
              className="polo-preview-video"
            />
          )}

          {/* Live Recording Badge & Timer */}
          {isRecording && (
            <div className="polo-recording-badge">
              <span className="polo-rec-dot"></span>
              <span>{formatTime(recordTime)} / 1:00</span>
            </div>
          )}

          {/* Real-time speech transcript caption overlay */}
          {transcript && (
            <div className="polo-live-subtitles">
              <p>{transcript}</p>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="polo-bottom-bar gio-bottom-bar">
          {!isPreviewing ? (
            <>
              {/* Mode Switcher */}
              <div className="polo-mode-switcher gio-mode-switcher">
                <button
                  type="button"
                  className={`polo-mode-tab ${mode === 'voice' ? 'active' : ''}`}
                  onClick={() => setMode('voice')}
                >
                  Voice
                </button>
                <button
                  type="button"
                  className={`polo-mode-tab ${mode === 'gio' || mode === 'polo' ? 'active' : ''}`}
                  onClick={() => setMode('gio')}
                >
                  📹 Gio Video
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
                    <span>Send Gio Video</span>
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

