import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import "./PhotoStudio.css";
import html2canvas from "html2canvas";
import { motion } from "framer-motion";

const filters = [
  "90s",
  "2000s",
  "Noir",
  "Fisheye",
  "Rainbow",
  "Glitch",
  "Crosshatch",
];

const PhotoStudio = ({ onBack }) => {
  // Default back handler if none provided
  const handleBack =
    onBack ||
    (() => {
      // This will be handled by the parent component, fallback to reload
      window.location.reload();
    });
  const [selectedFilter, setSelectedFilter] = useState("90s");
  const [photos, setPhotos] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const webcamRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null); // New state for error
  const [uploadResults, setUploadResults] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;
  console.log("🌐 Using API:", API_URL);

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const getFilterClass = (filter) => {
    switch (filter.toLowerCase()) {
      case "90s":
        return "_90s";
      case "2000s":
        return "_2000s";
      default:
        return filter.toLowerCase();
    }
  };

  const takePhoto = async () => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    let cssFilter = "none";
    switch (selectedFilter.toLowerCase()) {
      case "noir":
        cssFilter = "grayscale(1) contrast(0.8) brightness(1.1)";
        break;
      case "90s":
        cssFilter =
          "contrast(1.1) sepia(0.3) hue-rotate(-10deg) saturate(0.8) brightness(1.1)";
        break;
      case "2000s":
        cssFilter =
          "saturate(1.8) contrast(1.05) brightness(1.1) sepia(0.1) hue-rotate(10deg)";
        break;
      case "rainbow":
        cssFilter = "hue-rotate(90deg)";
        break;
      case "glitch":
        cssFilter = "contrast(1.5) saturate(2)";
        break;
      case "crosshatch":
        cssFilter = "grayscale(0.5) blur(1px)";
        break;
      case "fisheye":
        cssFilter = "brightness(1.1)";
        break;
    }

    ctx.filter = cssFilter;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const filteredImg = canvas.toDataURL("image/jpeg");
    setPhotos((prev) => [
      ...prev,
      { src: filteredImg, filter: selectedFilter },
    ]);
  };

  const countdownStep = async (value) => {
    setCountdown(value);
    await new Promise((r) => requestAnimationFrame(r));
    await delay(1000);
  };

  const startPhotoSequence = async () => {
    setIsCapturing(true);
    setPhotos([]);
    setShowResult(false);
    setUploaded(false);
    setUploadError(null); // Reset error

    for (let i = 0; i < 3; i++) {
      await countdownStep("3");
      await countdownStep("2");
      await countdownStep("1");
      await countdownStep("Smile 😄");
      await takePhoto();
      setCountdown(null);
      await delay(400);
    }

    setIsCapturing(false);
    setShowResult(true);
  };

  const handleReshoot = () => {
    setPhotos([]);
    setShowResult(false);
    setUploaded(false);
    setUploadError(null);
    setUploadResults(null);
  };

  const handleDownload = async () => {
    const frame = document.getElementById("photostrip-canvas-source");
    if (!frame) return;
    const canvas = await html2canvas(frame, { useCORS: true });
    const dataURL = canvas.toDataURL("image/jpeg");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "StudioStrip.jpg";
    link.click();
  };

  // Resizing utility (kept as is)
  const resizeDataUrl = (dataUrl, maxWidth = 1200, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.width / img.height || 1;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          width = maxWidth;
          height = Math.round(width / ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const resized = canvas.toDataURL("image/jpeg", quality);
          resolve(resized);
        } catch (err) {
          console.warn('Resize toDataURL failed', err);
          resolve(dataUrl);
        }
      };
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });

  // Upload effect (updated for better error handling)
  useEffect(() => {
    if (showResult && photos.length > 0 && !uploaded && !uploading && !uploadError) {
      const uploadPhotos = async () => {
        setUploading(true);
        setUploadError(null);
        try {
          const resized = await Promise.all(
            photos.map((p) => resizeDataUrl(p.src, 1200, 0.8).then((s) => ({ src: s, filter: p.filter })))
          );

          const resp = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: resized }),
          });

          // --- CRITICAL FIX: Handle potential non-JSON or empty response ---
          const text = await resp.text();
          let data = null;

          try {
            // This handles the 'Unexpected end of JSON input' by checking the response text.
            // If the server failed and sent an empty body, 'text' will be empty.
            data = text ? JSON.parse(text) : null;
          } catch (err) {
            // This indicates a parsing error, likely if the server returned non-JSON text (e.g., HTML error page).
            console.error("Upload returned non-JSON response:", err, text.substring(0, 200) + '...');
            throw new Error(`Invalid response from server (Status: ${resp.status}). Raw body: ${text.substring(0, 50)}...`);
          }
          // --- END CRITICAL FIX ---


          setUploadResults(data);

          if (resp.ok && data && data.success) {
            setUploaded(true);
          } else if (!resp.ok && data && data.error) {
            // Server returned an error, but in valid JSON (e.g., 400 or 500 with a body)
            throw new Error(data.error);
          } else {
            // Handle server error with no descriptive JSON body or resp.ok is false
            throw new Error(`Upload failed with status ${resp.status}.`);
          }

        } catch (err) {
          console.error("Upload failed in client logic:", err);
          setUploadError(err.message || "Failed to connect to server or upload.");
          setUploaded(false);
        } finally {
          setUploading(false);
        }
      };

      uploadPhotos();
    }
  }, [showResult, photos, uploaded, uploading, uploadError, API_URL]);

  return (
    <motion.div
      className="studio-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {!showResult ? (
        // ... (Capturing UI remains the same)
        <div className="studio-body">
          <div className="left-panel">
            <div className={`webcam-box ${getFilterClass(selectedFilter)}`}>
              {countdown && <div className="countdown">{countdown}</div>}
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="webcam-feed"
              />
            </div>

            <div className="filter-container">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`filter-option ${selectedFilter === filter ? "active" : ""
                    }`}
                  disabled={isCapturing}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="right-panel">
            <div className="studio-header">
              <button
                className="back-btn"
                onClick={handleBack}
                disabled={isCapturing}
              >
                ← Back to Booth
              </button>
              <h2 className="studio-title">Digital Vintage Studio 📸</h2>
              <p className="studio-sub">
                Pick a filter, pose & let's create memories.
              </p>
            </div>
            <button
              className="capture-btn-modern"
              onClick={startPhotoSequence}
              disabled={isCapturing}
            >
              {isCapturing ? "Capturing..." : "Capture Moments"}
            </button>
          </div>
        </div>
      ) : (
        // Result UI (updated to show upload error)
        <div className="result-screen">
          <button className="back-btn result-back-btn" onClick={handleBack}>
            ← Back to Booth
          </button>
          <div className="result-frame" id="photostrip-canvas-source">
            {photos.map((photo, idx) => (
              <img
                key={idx}
                src={photo.src}
                alt={`snap-${idx}`}
                className="result-photo"
              />
            ))}
            <p className="result-caption">
              Studio Memories •{" "}
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="result-actions">
            <button className="reshoot-btn" onClick={handleReshoot}>
              🔁 Retake
            </button>
            <button className="download-btn" onClick={handleDownload}>
              ⬇️ Download
            </button>
          </div>
          <div style={{ marginTop: 12, textAlign: "center" }}>
            {uploading ? (
              <p style={{ color: "#00eaff" }}>Uploading to cloud...</p>
            ) : uploadError ? (
              <div style={{ color: '#ff6961', padding: '10px', border: '1px solid #ff6961', borderRadius: '4px' }}>
                <p>Upload failed ❌</p>
                <p style={{ fontSize: '0.8em', margin: 0 }}>**Error:** {uploadError}</p>
              </div>
            ) : uploaded ? (
              <div style={{ color: "#00eaff" }}>
                <p>Saved to cloud ✅</p>
                {uploadResults && uploadResults.results && (
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {uploadResults.results.map((r, i) => (
                      <li key={i} style={{ opacity: r.uploaded ? 1 : 0.5 }}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: r.uploaded ? "#00ffc8" : "#ff6961" }}
                        >
                          Photo {i + 1} {r.uploaded ? '' : '(Failed)'}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p style={{ color: "#fff", opacity: 0.8 }}>Saving to cloud...</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PhotoStudio;