"use client";
import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { speak, getSpeechParams } from "@/speech/speechSynthesis.js";

export default function CameraGuide() {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const feedbackRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [openCvLoaded, setOpenCvLoaded] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [error, setError] = useState("");
  const [bookFeedback, setBookFeedback] = useState("");
  const [stableFrames, setStableFrames] = useState(0);
  const [bookDetected, setBookDetected] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [extractedTextArray, setExtractedTextArray] = useState([]);
  // Function to call when OpenCV.js is loaded
  const onOpenCvReady = () => {
    console.log("OpenCV.js is ready");
    setOpenCvLoaded(true);
  };

  const speakText = (text, mood) => {
    const utterance = new SpeechSynthesisUtterance(text);
    let rate = 1.0;
    let pitch = 1.0;
    switch (mood) {
      case "happy":
        rate = 1.2;
        pitch = 1.2;
        break;
      case "sad":
        rate = 0.8;
        pitch = 0.8;
        break;
      case "angry":
        rate = 1.5;
        pitch = 1.0;
        break;
      default:
        rate = 1.0;
        pitch = 1.0;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (extractedTextArray.length > 0) {
      extractedTextArray.forEach(({ sentence, emotion }) => {
        const { rate, pitch } = getSpeechParams(emotion);
        speak(sentence, rate, pitch);
      });
    }
  }, [extractedTextArray]);

  // Initialize camera
  useEffect(() => {
    const video = videoRef.current;

    async function startCamera() {
      if (!video) return;

      try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 }, // Higher resolution for better text clarity
            height: { ideal: 720 },
            facingMode: "environment", // Prefer back camera if available
          },
        });

        video.srcObject = stream;

        // Wait for video to be ready
        video.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          video
            .play()
            .then(() => {
              console.log(
                "Camera started successfully. Video dimensions:",
                video.videoWidth,
                "x",
                video.videoHeight,
              );
              setCameraStarted(true);
            })
            .catch((err) => {
              console.error("Error playing video:", err);
              setError("Error starting video playback: " + err.message);
            });
        };
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Unable to access camera: " + err.message);
      }
    }

    startCamera();

    // Clean up camera on unmount
    return () => {
      if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        console.log("Camera stopped");
      }
    };
  }, []); // Run once on component mount

  // Process frames with OpenCV when both camera and OpenCV are ready
  useEffect(() => {
    if (!cameraStarted || !openCvLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    let animationFrameId = null;
    let capturedImage = false;
    let currentStableFrames = 0;
    const stableThreshold = 15; // Number of stable frames before capture

    console.log("Both camera and OpenCV are ready. Starting frame processing.");

    // Create canvas with the same dimensions as the video
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log(
        "Canvas dimensions set to:",
        canvas.width,
        "x",
        canvas.height,
      );
    }

    const detectBook = (src, dst) => {
      // Create debug display if needed
      let debugDisplay = dst;
      if (debugMode) {
        debugDisplay = new cv.Mat(src.rows, src.cols, src.type());
        src.copyTo(debugDisplay);
      }

      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply adaptive thresholding to better detect text regions
      const binary = new cv.Mat();
      cv.adaptiveThreshold(
        gray,
        binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        11,
        2,
      );

      // Apply morphological operations to enhance text regions
      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      const morphed = new cv.Mat();
      cv.morphologyEx(
        binary,
        morphed,
        cv.MORPH_CLOSE,
        kernel,
        new cv.Point(-1, -1),
        1,
      );

      // Find text regions (potential book areas)
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        morphed,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      // Apply additional edge detection for book boundaries
      const edges = new cv.Mat();
      cv.Canny(gray, edges, 75, 200);

      // Dilate edges to connect fragmented lines
      const dilatedEdges = new cv.Mat();
      cv.dilate(edges, dilatedEdges, kernel, new cv.Point(-1, -1), 1);

      // Find edge contours (potential book outlines)
      const edgeContours = new cv.MatVector();
      const edgeHierarchy = new cv.Mat();
      cv.findContours(
        dilatedEdges,
        edgeContours,
        edgeHierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );

      // Debug visualization
      if (debugMode) {
        // Draw all contours for debugging
        for (let i = 0; i < contours.size(); i++) {
          const color = new cv.Scalar(0, 255, 0, 255); // Green for text regions
          cv.drawContours(debugDisplay, contours, i, color, 1);
        }

        for (let i = 0; i < edgeContours.size(); i++) {
          const color = new cv.Scalar(255, 0, 0, 255); // Red for edge contours
          cv.drawContours(debugDisplay, edgeContours, i, color, 1);
        }
      }

      // Analysis variables
      let bookFound = false;
      let bookRect = { x: 0, y: 0, width: 0, height: 0 };
      let maxScore = 0;
      const minArea = 10000; // Minimum area for a book
      const maxArea = src.rows * src.cols * 0.9; // Maximum area (90% of frame)

      // Function to score a potential book rectangle
      const scoreRectangle = (rect, textDensity) => {
        const { x, y, width, height } = rect;

        // Reject rectangles that are too small or too large
        if (width * height < minArea || width * height > maxArea) return 0;

        // Reject rectangles that are too thin
        const aspectRatio = width / height;
        if (aspectRatio < 0.5 || aspectRatio > 2.0) return 0;

        // Score based on size (prefer larger), aspect ratio (prefer book-like ratio),
        // and text density (prefer areas with text)
        const sizeScore =
          Math.sqrt(width * height) / Math.sqrt(src.rows * src.cols);
        const ratioScore = aspectRatio > 0.6 && aspectRatio < 1.6 ? 1.0 : 0.5;

        // Combined score
        return sizeScore * ratioScore * (textDensity + 0.5);
      };

      // First, analyze edge contours (book outlines)
      for (let i = 0; i < edgeContours.size(); i++) {
        const contour = edgeContours.get(i);
        const area = cv.contourArea(contour);

        if (area > minArea && area < maxArea) {
          // Get approximate polygon
          const perimeter = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.04 * perimeter, true);

          // Check if it's roughly quadrilateral (4-6 points) - books may not be perfect rectangles
          if (approx.rows >= 4 && approx.rows <= 6) {
            const rect = cv.boundingRect(contour);

            // Calculate text density in this region
            const mask = new cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8UC1);
            cv.rectangle(
              mask,
              new cv.Point(rect.x, rect.y),
              new cv.Point(rect.x + rect.width, rect.y + rect.height),
              new cv.Scalar(255),
              -1,
            );

            // Fix: Create a destination matrix for bitwise_and operation
            const maskedBinary = new cv.Mat();
            cv.bitwise_and(binary, mask, maskedBinary);
            const textPixels = cv.countNonZero(maskedBinary);
            const textDensity = textPixels / (rect.width * rect.height);

            const score = scoreRectangle(rect, textDensity);

            if (score > maxScore) {
              maxScore = score;
              bookRect = { ...rect };
              bookFound = true;
            }

            mask.delete();
            maskedBinary.delete();
          }

          approx.delete();
        }
      }

      // If no book found with edge detection, try using text clusters
      if (!bookFound) {
        // Cluster text regions
        const textMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);

          // Only consider medium-sized contours (to avoid noise)
          if (area > 50 && area < 5000) {
            cv.drawContours(textMask, contours, i, new cv.Scalar(255), -1);
          }
        }

        // Dilate text regions to connect nearby text
        const dilatedText = new cv.Mat();
        const textKernel = cv.Mat.ones(20, 20, cv.CV_8U);
        cv.dilate(textMask, dilatedText, textKernel, new cv.Point(-1, -1), 1);

        // Find connected text regions
        const textClusters = new cv.MatVector();
        const textHierarchy = new cv.Mat();
        cv.findContours(
          dilatedText,
          textClusters,
          textHierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE,
        );

        // Evaluate each text cluster
        for (let i = 0; i < textClusters.size(); i++) {
          const cluster = textClusters.get(i);
          const rect = cv.boundingRect(cluster);
          const area = rect.width * rect.height;

          if (area > minArea && area < maxArea) {
            // Calculate text density
            const clusterMask = new cv.Mat.zeros(
              src.rows,
              src.cols,
              cv.CV_8UC1,
            );
            cv.rectangle(
              clusterMask,
              new cv.Point(rect.x, rect.y),
              new cv.Point(rect.x + rect.width, rect.y + rect.height),
              new cv.Scalar(255),
              -1,
            );

            // Fix: Create a destination matrix for bitwise_and operation
            const maskedBinary = new cv.Mat();
            cv.bitwise_and(binary, clusterMask, maskedBinary);
            const textPixels = cv.countNonZero(maskedBinary);
            const textDensity = textPixels / area;

            const score = scoreRectangle(rect, textDensity);

            if (score > maxScore) {
              maxScore = score;
              bookRect = { ...rect };
              bookFound = true;
            }

            clusterMask.delete();
            maskedBinary.delete();
          }
        }

        textMask.delete();
        dilatedText.delete();
        textClusters.delete();
        textHierarchy.delete();
        textKernel.delete();
      }

      // Draw the result and calculate text clarity metrics
      let textClarity = 0;
      if (bookFound) {
        // Calculate text clarity
        const bookROI = gray.roi(
          new cv.Rect(bookRect.x, bookRect.y, bookRect.width, bookRect.height),
        );
        const sobelX = new cv.Mat();
        const sobelY = new cv.Mat();

        // Calculate gradients (a measure of text edges)
        cv.Sobel(bookROI, sobelX, cv.CV_64F, 1, 0, 3);
        cv.Sobel(bookROI, sobelY, cv.CV_64F, 0, 1, 3);

        // Calculate gradient magnitude
        const gradientMag = new cv.Mat();
        cv.magnitude(sobelX, sobelY, gradientMag);

        // Calculate average gradient magnitude (higher = clearer text)
        const mean = cv.mean(gradientMag);
        textClarity = mean[0];

        // Draw rectangle on the output
        cv.rectangle(
          dst,
          new cv.Point(bookRect.x, bookRect.y),
          new cv.Point(
            bookRect.x + bookRect.width,
            bookRect.y + bookRect.height,
          ),
          new cv.Scalar(0, 255, 0, 255),
          2,
        );

        bookROI.delete();
        sobelX.delete();
        sobelY.delete();
        gradientMag.delete();
      }

      // Clean up
      gray.delete();
      binary.delete();
      morphed.delete();
      edges.delete();
      dilatedEdges.delete();
      contours.delete();
      hierarchy.delete();
      edgeContours.delete();
      edgeHierarchy.delete();
      kernel.delete();

      // Show debug display if needed
      if (debugMode) {
        debugDisplay.copyTo(dst);
        debugDisplay.delete();
      }

      // Return results
      return {
        bookRect,
        bookFound,
        textClarity,
      };
    };

    const isBookCentered = (bookResult, frameSize) => {
      const { bookRect, bookFound, textClarity } = bookResult;

      // Define grid dimensions
      const gridCols = 3;
      const gridRows = 3;

      // Get the center grid cell coordinates
      const cellWidth = frameSize.width / gridCols;
      const cellHeight = frameSize.height / gridRows;

      const centerCellX = cellWidth;
      const centerCellY = cellHeight;
      const centerCellWidth = cellWidth;
      const centerCellHeight = cellHeight;

      // If no book detected, return early
      if (!bookFound) {
        return {
          centered: false,
          feedback:
            "No book detected. Place a book with visible text in frame.",
        };
      }

      // Calculate book center point
      const bookCenterX = bookRect.x + bookRect.width / 2;
      const bookCenterY = bookRect.y + bookRect.height / 2;

      // Check position relative to center cell
      const tooFarLeft = bookCenterX < centerCellX;
      const tooFarRight = bookCenterX > centerCellX + centerCellWidth;
      const tooFarUp = bookCenterY < centerCellY;
      const tooFarDown = bookCenterY > centerCellY + centerCellHeight;

      // Book should also be of a minimum size
      const minSizeRatio = 0.3; // Book should occupy at least 30% of the center cell
      const maxSizeRatio = 0.9; // Book shouldn't be too big either
      const sizeRatioX = bookRect.width / centerCellWidth;
      const sizeRatioY = bookRect.height / centerCellHeight;

      const tooSmall = sizeRatioX < minSizeRatio || sizeRatioY < minSizeRatio;
      const tooBig = sizeRatioX > maxSizeRatio && sizeRatioY > maxSizeRatio;

      // // Text clarity check
      const minClarity = 20; // Minimum text clarity value (adjust based on testing)
      const textNotClear = textClarity < minClarity;

      // Generate appropriate feedback
      let feedback = "";
      if (tooFarLeft) feedback += "Move book right. ";
      if (tooFarRight) feedback += "Move book left. ";
      if (tooFarUp) feedback += "Move book down. ";
      if (tooFarDown) feedback += "Move book up. ";
      if (tooSmall) feedback += "Move book closer. ";
      if (tooBig) feedback += "Move book farther away. ";
      if (textNotClear)
        feedback += "Text not clear enough, move closer or adjust lighting. ";

      // If no positioning issues, book is centered
      const isCentered =
        !tooFarLeft &&
        !tooFarRight &&
        !tooFarUp &&
        !tooFarDown &&
        !tooSmall &&
        !tooBig &&
        !textNotClear;

      if (isCentered) {
        feedback = "Perfect! Book is positioned correctly with clear text.";
      }

      return {
        centered: isCentered,
        feedback: feedback,
      };
    };

    const drawGrid = (dst) => {
      const frameWidth = dst.cols;
      const frameHeight = dst.rows;

      const gridCols = 3;
      const gridRows = 3;
      const cellWidth = Math.floor(frameWidth / gridCols);
      const cellHeight = Math.floor(frameHeight / gridRows);

      // Draw vertical lines
      for (let i = 1; i < gridCols; i++) {
        const x = i * cellWidth;
        cv.line(
          dst,
          new cv.Point(x, 0),
          new cv.Point(x, frameHeight),
          new cv.Scalar(255, 255, 255, 200),
          1,
        );
      }

      // Draw horizontal lines
      for (let i = 1; i < gridRows; i++) {
        const y = i * cellHeight;
        cv.line(
          dst,
          new cv.Point(0, y),
          new cv.Point(frameWidth, y),
          new cv.Scalar(255, 255, 255, 200),
          1,
        );
      }

      // Highlight the center cell
      const centerX = cellWidth;
      const centerY = cellHeight;
      cv.rectangle(
        dst,
        new cv.Point(centerX, centerY),
        new cv.Point(centerX + cellWidth, centerY + cellHeight),
        new cv.Scalar(255, 0, 0, 150),
        2,
      );
    };

    const processFrame = () => {
      if (capturedImage || !cameraStarted || !openCvLoaded) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      if (!video || !canvas || video.videoWidth === 0) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      // Draw the video frame to canvas
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        // Process with OpenCV
        const src = cv.imread(canvas);
        const dst = new cv.Mat(src.rows, src.cols, src.type());
        src.copyTo(dst);

        // Draw the grid
        drawGrid(dst);

        // Detect book and get its position
        const bookResult = detectBook(src, dst);

        // Update bookDetected state
        setBookDetected(bookResult.bookFound);

        // Check if book is centered in the grid
        const frameSize = { width: canvas.width, height: canvas.height };
        const positionStatus = isBookCentered(bookResult, frameSize);

        // Update feedback
        setBookFeedback(positionStatus.feedback);

        // Handle stable frames for auto-capture
        if (positionStatus.centered) {
          currentStableFrames++;
          setStableFrames(currentStableFrames);

          // Auto-capture when stable for enough frames
          if (currentStableFrames >= stableThreshold && !capturedImage) {
            capturedImage = true;
            const dataURL = canvas.toDataURL("image/png");
            sendImageToBackend(dataURL);

            // Display capture success message
            const successMsg =
              "Book detected and aligned correctly! Capturing image...";
            cv.putText(
              dst,
              successMsg,
              new cv.Point(10, dst.rows - 20),
              cv.FONT_HERSHEY_SIMPLEX,
              0.5,
              new cv.Scalar(0, 255, 0, 255),
              1,
            );
          }

          // Show progress toward capture
          const progressMsg = `Stable: ${currentStableFrames}/${stableThreshold}`;
          cv.putText(
            dst,
            progressMsg,
            new cv.Point(10, 30),
            cv.FONT_HERSHEY_SIMPLEX,
            0.5,
            new cv.Scalar(255, 255, 255, 255),
            1,
          );
        } else {
          // Reset stable frame counter if book moves
          currentStableFrames = 0;
          setStableFrames(0);
        }

        // Show the result
        cv.imshow(canvas, dst);

        // Clean up
        src.delete();
        dst.delete();
      } catch (err) {
        console.error("Error in OpenCV processing:", err);
        // If OpenCV fails, just show the camera feed
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    // Start processing frames
    processFrame();

    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [cameraStarted, openCvLoaded, debugMode]);

  const sendImageToBackend = async (imageData, fromCamera = false) => {
    setIsCapturing(true);
    try {
      let blob;
      if (typeof imageData === "string") {
        // dataURL
        const res = await fetch(imageData);
        blob = await res.blob();
      } else if (imageData instanceof Blob) {
        blob = imageData;
      } else {
        throw new Error("Invalid image data");
      }
      const formData = new FormData();
      formData.append("file", blob, "image.png");
      const response = await fetch("http://localhost:8000/process-image/", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setExtractedTextArray(data.sentences);
      if (feedbackRef.current) {
        feedbackRef.current.textContent = "Image processed successfully!";
      }
    } catch (error) {
      console.error("Error sending image to backend:", error);
      if (feedbackRef.current) {
        feedbackRef.current.textContent = "Error: " + error.message;
      }
    } finally {
      setIsCapturing(false);
      if (fromCamera) {
        setCameraStarted(false);
      }
    }
  };

  const handleUploadClick = () => {
    const file = fileInputRef.current.files[0];
    if (file) {
      sendImageToBackend(file);
    } else {
      alert("Please select a file first.");
    }
  };

  useEffect(() => {
    if (!cameraStarted && videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      console.log("Camera stopped");
    }
  }, [cameraStarted]);
  // Manual capture button handler
  const handleCaptureClick = () => {
    if (!canvasRef.current) return;

    const dataURL = canvasRef.current.toDataURL("image/png");
    sendImageToBackend(dataURL);
  };

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {/* Load OpenCV.js */}
      <Script
        src="https://docs.opencv.org/4.7.0/opencv.js"
        onLoad={onOpenCvReady}
        strategy="afterInteractive"
      />

      <h1 className="text-2xl font-bold mb-4">Book Scanner</h1>

      {/* Status indicators */}
      <div className="mb-4 flex gap-4">
        <div
          className={`px-3 py-1 rounded ${openCvLoaded ? "bg-green-500" : "bg-yellow-500"} text-white`}
        >
          OpenCV: {openCvLoaded ? "Loaded" : "Loading..."}
        </div>
        <div
          className={`px-3 py-1 rounded ${cameraStarted ? "bg-green-500" : "bg-yellow-500"} text-white`}
        >
          Camera: {cameraStarted ? "Ready" : "Starting..."}
        </div>
        <div
          className={`px-3 py-1 rounded ${bookDetected ? "bg-green-500" : "bg-red-500"} text-white`}
        >
          Book: {bookDetected ? "Detected" : "Not Found"}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Book positioning feedback */}
      <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded max-w-md text-center">
        <p className="font-bold mb-1">Position Guide:</p>
        <p>
          {bookFeedback ||
            "Place a book with visible text in the view and center it in the red box"}
        </p>
        {stableFrames > 0 && (
          <p className="mt-2 font-semibold">
            Stabilizing: {stableFrames}/15 frames
          </p>
        )}
      </div>

      {/* Video and canvas container */}
      <div className="relative mb-4 border-2 border-gray-300 rounded-lg overflow-hidden max-w-md">
        {/* Video element - hidden but used as source */}
        <video
          ref={videoRef}
          className="w-full"
          autoPlay
          playsInline
          muted
          style={{ display: "none" }}
        ></video>

        {/* Canvas - visible, shows processed frames */}
        <canvas ref={canvasRef} className="w-full"></canvas>

        {/* Loading overlay */}
        {(!cameraStarted || !openCvLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-lg font-semibold">
              {!openCvLoaded ? "Loading OpenCV.js..." : "Starting camera..."}
            </div>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="mb-4 flex gap-4">
        <button
          onClick={handleCaptureClick}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          disabled={isCapturing || !cameraStarted || !openCvLoaded}
        >
          {isCapturing ? "Processing..." : "Manual Capture"}
        </button>

        <button
          onClick={toggleDebugMode}
          className={`px-4 py-2 ${debugMode ? "bg-purple-500" : "bg-gray-500"} text-white rounded hover:${debugMode ? "bg-purple-600" : "bg-gray-600"}`}
          disabled={!cameraStarted || !openCvLoaded}
        >
          {debugMode ? "Debug Mode: ON" : "Debug Mode: OFF"}
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Manual Upload</h3>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="mb-2"
        />
        <button
          onClick={handleUploadClick}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          disabled={isCapturing}
        >
          {isCapturing ? "Processing..." : "Upload Image"}
        </button>
      </div>

      {/* Processing feedback area */}
      <div ref={feedbackRef} className="mt-2 text-center text-gray-700 min-h-8">
        {cameraStarted && openCvLoaded
          ? "Position the book in the center red square for automatic capture"
          : "Initializing system..."}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded max-w-md text-sm">
        <p className="font-bold mb-1">Tips for best results:</p>
        <ul className="list-disc list-inside">
          <li>Use good lighting to ensure text is visible</li>
          <li>Avoid glare on book pages</li>
          <li>Hold the book steady and flat</li>
          <li>Ensure text is large enough to be readable</li>
          <li>Toggle debug mode to see detection details</li>
        </ul>
      </div>
      {extractedTextArray.length > 0 && (
        <div className="mt-4 p-4 bg-white rounded shadow max-w-md">
          <h2 className="text-xl font-bold mb-2 text-black">Extracted Text</h2>
          {extractedTextArray.map((sentence, index) => (
            <p key={index} className="text-black">
              {sentence.sentence}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
