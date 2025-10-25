import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import PhotoStudio from "./PhotoStudio";
import "./PhotoBooth.css";

const PhotoBooth = () => {
  const [coinInserted, setCoinInserted] = useState(false);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const webcamRef = useRef(null);

  const handleInsertClick = () => {
    setCoinInserted(true);
    // Add haptic feedback simulation
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  const handleCoinClick = () => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setCurtainOpen(true);

    // Add sound effect simulation (visual feedback)
    setTimeout(() => {
      setShowStudio(true);
      setIsTransitioning(false);
    }, 1200);
  };

  const handleCameraError = (error) => {
    console.error("Camera error:", error);
    setCameraError("Camera access denied. Please check permissions.");
    setCameraLoading(false);
  };

  const handleCameraLoad = () => {
    console.log("Camera loaded successfully");
    setCameraLoading(false);
    setCameraError(null);
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setCameraLoading(true);
  };

  // Check camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Camera not supported in this browser");
          setCameraLoading(false);
          return;
        }

        // Test camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        stream.getTracks().forEach((track) => track.stop());
        setCameraLoading(false);
      } catch (error) {
        setCameraError(
          "Camera access denied. Please allow camera permissions."
        );
        setCameraLoading(false);
      }
    };

    checkCamera();
  }, []);

  if (showStudio) {
    return <PhotoStudio />;
  }

  return (
    <div
      className="booth-container"
      role="main"
      aria-label="Digital Vintage PhotoBooth"
    >
      <div className="booth-header">
        <div className="header-content">
          <div className="header-icon" aria-hidden="true">
            📸
          </div>
          <div className="header-text">
            <h1>DV PhotoBooth</h1>
            <p className="header-subtitle">Digital Vintage Experience</p>
          </div>
        </div>
      </div>

      <div className="booth-body">
        <div
          className="coin-slot"
          role="region"
          aria-label="Coin insertion slot"
        >
          <div className="coin-slot-header">
            <div className="slot-indicator" aria-hidden="true"></div>
            <span>COIN SLOT</span>
          </div>
          {!coinInserted ? (
            <div
              className="insert-area"
              onClick={handleInsertClick}
              role="button"
              tabIndex={0}
              aria-label="Insert coin to start photo session"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleInsertClick();
                }
              }}
            >
              <div className="insert-icon" aria-hidden="true">
                🪙
              </div>
              <p className="insert-text">
                INSERT
                <br />
                COIN HERE
              </p>
              <div className="insert-arrow" aria-hidden="true">
                ↓
              </div>
            </div>
          ) : (
            <div className="coin-container">
              <div
                className="coin"
                onClick={handleCoinClick}
                role="button"
                tabIndex={0}
                aria-label="Click coin to start photo session"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCoinClick();
                  }
                }}
              >
                <div className="coin-inner" aria-hidden="true"></div>
              </div>
              <p className="coin-text">Click to Start!</p>
            </div>
          )}
        </div>

        <div className="curtain-wrapper">
          <div className="webcam-container">
            {cameraError ? (
              <div className="camera-error-display">
                <div className="error-icon">📷</div>
                <p className="error-message">{cameraError}</p>
                <button
                  className="retry-camera-btn"
                  onClick={handleRetryCamera}
                  aria-label="Retry camera access"
                >
                  Retry Camera
                </button>
              </div>
            ) : cameraLoading ? (
              <div className="camera-loading-display">
                <div className="loading-spinner"></div>
                <p className="loading-text">Initializing Camera...</p>
              </div>
            ) : (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="webcam-preview"
                  onUserMediaError={handleCameraError}
                  onUserMedia={handleCameraLoad}
                  videoConstraints={{
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                  }}
                />
                <div className="webcam-overlay">
                  <div className="overlay-text">LIVE PREVIEW</div>
                </div>
              </>
            )}
          </div>
          <div className={`curtain ${curtainOpen ? "open" : ""}`}>
            <div className="curtain-pattern"></div>
          </div>
        </div>
      </div>

      <div className="booth-footer">
        <div className="status-indicator">
          <div className={`status-dot ${coinInserted ? "active" : ""}`}></div>
          <span>
            {cameraError
              ? "Camera Error - Check Permissions"
              : cameraLoading
              ? "Initializing Camera..."
              : isTransitioning
              ? "Starting Photo Session..."
              : coinInserted
              ? "Ready to Start"
              : "Insert Coin to Begin"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PhotoBooth;
