import { useState, useRef } from 'react';
import { uploadMedia } from '../api/mediaApi';
import { createPost } from '../api/postApi';
import { REEL_MAX_DURATION_SECONDS, REEL_EXPIRY_MS } from '../utils/reelsData';
import '../styles/reels.css';

export default function CreateReelModal({ isOpen, user, onClose, onReelCreated }) {
  const [mode, setMode] = useState('photos'); // 'photos' | 'video'
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState([]); // [{ file, previewUrl }]
  const [video, setVideo] = useState(null); // { file, previewUrl, duration }
  const [videoError, setVideoError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  if (!isOpen) return null;

  // Handle Photo selection (Multiple photos supported)
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPhotos = files.slice(0, 6 - photos.length).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 6));
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Video selection (Strict 30s limit check)
  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError('');
    const tempUrl = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.src = tempUrl;

    videoEl.onloadedmetadata = () => {
      const duration = videoEl.duration;
      if (duration > REEL_MAX_DURATION_SECONDS + 0.5) {
        setVideo(null);
        setVideoError(
          `⚠️ Video duration is ${Math.round(duration)} seconds! Reel videos must be 30 seconds or less.`
        );
        URL.revokeObjectURL(tempUrl);
      } else {
        setVideo({
          file,
          previewUrl: tempUrl,
          duration: Math.min(duration, REEL_MAX_DURATION_SECONDS),
        });
        setVideoError('');
      }
    };

    videoEl.onerror = () => {
      setVideo(null);
      setVideoError('Could not load video metadata. Please try another video file.');
      URL.revokeObjectURL(tempUrl);
    };

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleRemoveVideo = () => {
    if (video?.previewUrl) {
      URL.revokeObjectURL(video.previewUrl);
    }
    setVideo(null);
    setVideoError('');
  };

  // Submit and create 5-hour reel
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'photos' && photos.length === 0) return;
    if (mode === 'video' && (!video || videoError)) return;

    setIsUploading(true);

    try {
      let reelItems = [];

      if (mode === 'photos') {
        // Upload each photo or use local object URL
        for (let i = 0; i < photos.length; i++) {
          let itemUrl = photos[i].previewUrl;
          try {
            const res = await uploadMedia(photos[i].file, 'image');
            if (res && res.url) itemUrl = res.url;
          } catch (uploadErr) {
            console.warn('Backend upload failed, using local blob:', uploadErr);
          }
          reelItems.push({
            id: `item-${Date.now()}-${i}`,
            url: itemUrl,
            type: 'image',
            duration: 5,
            caption: i === 0 ? caption.trim() : '',
          });
        }
      } else if (mode === 'video') {
        let itemUrl = video.previewUrl;
        try {
          const res = await uploadMedia(video.file, 'video');
          if (res && res.url) itemUrl = res.url;
        } catch (uploadErr) {
          console.warn('Backend video upload failed, using local blob:', uploadErr);
        }
        reelItems.push({
          id: `item-${Date.now()}-0`,
          url: itemUrl,
          type: 'video',
          duration: Math.round(video.duration || 10),
          caption: caption.trim(),
        });
      }

      const now = Date.now();
      let backendPostId = null;

      // Sync to backend posts so followed friends can immediately see the 5-hour reel
      try {
        const postRes = await createPost({
          content: caption.trim() ? caption.trim() : 'Shared a 5h status reel',
          mediaUrl: reelItems[0]?.url || '',
          mediaType: mode === 'video' ? 'video' : 'image',
        });
        if (postRes && postRes.id) {
          backendPostId = postRes.id;
        }
      } catch (syncErr) {
        console.warn('Backend post creation for reel status optional fallback:', syncErr);
      }

      const newReel = {
        id: backendPostId ? `post-reel-${backendPostId}` : `reel-${now}-${Math.random().toString(36).substring(2, 7)}`,
        postId: backendPostId,
        userId: user?.id || user?.userId || 'me',
        username: user?.username || 'me',
        displayName: user?.displayName || user?.username || 'You',
        userAvatar: user?.avatarUrl || null,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + REEL_EXPIRY_MS).toISOString(),
        type: mode === 'video' ? 'video' : 'image',
        caption: caption.trim(),
        likes: 0,
        likedByMe: false,
        items: reelItems,
      };

      onReelCreated(newReel);
      onClose();
    } catch (err) {
      console.error('Error creating reel:', err);
      alert('Failed to publish reel. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = mode === 'photos' ? photos.length > 0 : Boolean(video && !videoError);

  return (
    <div className="create-reel-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="create-reel-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-reel-header">
          <div className="create-reel-title-group">
            <div className="create-reel-icon-badge">
              <i className="fa-solid fa-camera-retro" />
            </div>
            <div className="create-reel-title-text">
              <h3>Create Status / Reel</h3>
              <span>Instagram-Style • 5h Expiry</span>
            </div>
          </div>
          <button
            type="button"
            className="create-reel-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="create-reel-body">
          {/* 5-Hour Duration Notice */}
          <div className="create-reel-5h-notice">
            <i className="fa-solid fa-bolt" />
            <span>This status reel will remain visible to friends for <strong>5 hours only</strong>, then automatically disappear.</span>
          </div>

          {/* Mode Selector Tabs */}
          <div className="create-reel-mode-tabs">
            <button
              type="button"
              className={`reel-mode-tab ${mode === 'photos' ? 'active' : ''}`}
              onClick={() => {
                setMode('photos');
                setVideoError('');
              }}
            >
              <i className="fa-solid fa-images" />
              <span>Photos (Multi-Photo)</span>
            </button>
            <button
              type="button"
              className={`reel-mode-tab ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
            >
              <i className="fa-solid fa-video" />
              <span>Short Video (Max 30s)</span>
            </button>
          </div>

          {/* Photos Mode Dropzone */}
          {mode === 'photos' && (
            <div>
              <input
                type="file"
                ref={photoInputRef}
                onChange={handlePhotoSelect}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />
              {photos.length < 6 && (
                <div
                  className="create-reel-dropzone"
                  onClick={() => photoInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <i className="fa-solid fa-cloud-arrow-up" />
                  <h4>Select Photos for Reel</h4>
                  <p>Choose 1 to 6 photos • Plays sequentially with Instagram progress bars</p>
                </div>
              )}

              {/* Photo Previews */}
              {photos.length > 0 && (
                <div className="photos-preview-grid">
                  {photos.map((p, idx) => (
                    <div key={idx} className="photo-preview-item">
                      <img src={p.previewUrl} alt={`Photo ${idx + 1}`} className="photo-preview-img" />
                      <button
                        type="button"
                        className="photo-remove-btn"
                        onClick={() => handleRemovePhoto(idx)}
                        title="Remove photo"
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Video Mode Dropzone */}
          {mode === 'video' && (
            <div>
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoSelect}
                accept="video/*"
                style={{ display: 'none' }}
              />
              {!video && (
                <div
                  className="create-reel-dropzone"
                  onClick={() => videoInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                >
                  <i className="fa-solid fa-film" />
                  <h4>Select Short Video Reel</h4>
                  <p>Must be <strong>30 seconds or less</strong> • Plays fullscreen like Instagram Reels</p>
                </div>
              )}

              {videoError && (
                <div className="video-duration-badge invalid">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{videoError}</span>
                </div>
              )}

              {video && !videoError && (
                <div style={{ position: 'relative', marginTop: '10px' }}>
                  <video
                    src={video.previewUrl}
                    style={{ width: '100%', maxHeight: '220px', borderRadius: '12px', background: '#000' }}
                    controls
                    playsInline
                  />
                  <div className="video-duration-badge valid">
                    <i className="fa-solid fa-circle-check" />
                    <span>Duration: {video.duration.toFixed(1)}s / 30s max</span>
                  </div>
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={handleRemoveVideo}
                    style={{ position: 'absolute', top: '10px', right: '10px' }}
                    title="Change video"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Caption Input */}
          <div>
            <textarea
              className="create-reel-caption-input"
              placeholder="Write a caption for your reel / status (optional)..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={240}
            />
          </div>

          {/* Footer Actions */}
          <div className="create-reel-footer">
            <button type="button" className="create-reel-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="create-reel-submit-btn"
              disabled={!canSubmit || isUploading}
            >
              {isUploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Sharing Reel...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane" />
                  <span>Share 5h Reel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
