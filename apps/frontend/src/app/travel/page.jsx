"use client";
import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs"; // Fixed import path
import * as cocoSsd from "@tensorflow-models/coco-ssd"; // Fixed import path
import { speak } from "@/speech/speechSynthesis";

// Define relevant COCO-SSD classes that might be obstacles for a blind person
const RELEVANT_CLASSES = [
  "cup",
  "knife",
  "chair",
  "table",
  "person",
  // Adding more common classes to increase detection chances
  "bottle",
  "cell phone",
  "book",
  "laptop",
  "keyboard",
  "mouse",
  "remote",
  "scissors",
  "vase",
  "backpack",
];

const ObjectDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [lastSpoken, setLastSpoken] = useState({});
  const [currentObjects, setCurrentObjects] = useState(new Set());
  const [previousObjects, setPreviousObjects] = useState(new Set());
  const [videoReady, setVideoReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState("Initializing...");
  const detectionRef = useRef(null);
  const announcementsRef = useRef({});

  // Keep track of when objects were last seen
  const lastSeenRef = useRef({});

  // Load the COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setDebugInfo("Loading TensorFlow...");
        // Force eager mode for debugging
        tf.setBackend("webgl");
        await tf.ready();

        setDebugInfo("Loading COCO-SSD model...");
        // Use mobilenet for better performance/accuracy balance
        const loadedModel = await cocoSsd.load({
          base: "mobilenet_v2",
        });

        setModel(loadedModel);
        setDebugInfo("Model loaded successfully!");
      } catch (error) {
        console.error("Error loading model:", error);
        setDebugInfo(`Model error: ${error.message}`);
      }
    };

    loadModel();

    // Cleanup function
    return () => {
      if (detectionRef.current) {
        cancelAnimationFrame(detectionRef.current);
      }

      // Clear any active announcements
      Object.values(announcementsRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Setup webcam
  useEffect(() => {
    const setupWebcam = async () => {
      try {
        setDebugInfo("Accessing camera...");
        const constraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "environment",
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video to be ready
          videoRef.current.onloadeddata = () => {
            setDebugInfo(
              "Camera ready, video dimensions: " +
                videoRef.current.videoWidth +
                "x" +
                videoRef.current.videoHeight,
            );
            setVideoReady(true);
          };

          await videoRef.current.play();
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
        setDebugInfo(`Camera error: ${error.message}`);
      }
    };

    setupWebcam();

    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Toggle detection on/off
  const toggleDetection = () => {
    setIsDetecting((prev) => {
      const newValue = !prev;
      setDebugInfo(
        newValue ? "Starting detection..." : "Stopping detection...",
      );

      // If we're stopping detection, cancel any ongoing animation frame
      if (!newValue && detectionRef.current) {
        cancelAnimationFrame(detectionRef.current);
        detectionRef.current = null;

        // Clear all announcements
        Object.values(announcementsRef.current).forEach((timeout) => {
          if (timeout) clearTimeout(timeout);
        });
        announcementsRef.current = {};

        // Stop any ongoing speech
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }

      return newValue;
    });
  };

  // Announce an object detection once and set a timeout for 6 seconds
  const announceObject = (obj) => {
    // Check if we're already announcing this object
    if (announcementsRef.current[obj]) {
      return; // Already being announced, don't announce again
    }

    // Announce the object
    let message = `Warning: ${obj} detected in your path.`;
    speak(message, 1.0, 1.0);

    // Set a timeout that prevents re-announcing this object for 6 seconds
    announcementsRef.current[obj] = setTimeout(() => {
      // Allow this object to be announced again after 6 seconds
      delete announcementsRef.current[obj];
    }, 6000);
  };

  // Detection function
  const detectObjects = async () => {
    if (!model || !videoRef.current || !canvasRef.current || !videoReady) {
      setDebugInfo(
        "Can't detect: " +
          (!model ? "No model. " : "") +
          (!videoReady ? "Video not ready. " : "") +
          (!videoRef.current ? "No video ref. " : "") +
          (!canvasRef.current ? "No canvas ref. " : ""),
      );
      detectionRef.current = requestAnimationFrame(detectObjects);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Make sure video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setDebugInfo("Video dimensions are zero, waiting...");
      detectionRef.current = requestAnimationFrame(detectObjects);
      return;
    }

    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    try {
      setDebugInfo("Running detection...");

      // Perform detection with a lower confidence threshold
      const predictions = await model.detect(video, undefined); // Let the model use its default threshold

      setDebugInfo(`Detection complete. Found ${predictions.length} objects`);
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw original video frame for debugging
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Save previous objects for comparison
      setPreviousObjects(currentObjects);

      // Track detected objects in this frame
      const newDetectedObjects = new Set();
      const relevantPredictions = [];

      // Filter and collect relevant predictions
      predictions.forEach((prediction) => {
        // Log all predictions for debugging
        console.log(
          `Detected: ${prediction.class} (${prediction.score.toFixed(2)})`,
        );

        if (RELEVANT_CLASSES.includes(prediction.class)) {
          relevantPredictions.push(prediction);
          newDetectedObjects.add(prediction.class);

          // Update the last seen timestamp for this object
          lastSeenRef.current[prediction.class] = Date.now();
        }
      });

      // Draw bounding boxes
      relevantPredictions.forEach((prediction) => {
        const [x, y, width, height] = prediction.bbox;
        const score = (prediction.score * 100).toFixed(1);
        const label = `${prediction.class} (${score}%)`;

        // Draw a more visible bounding box
        context.beginPath();
        context.rect(x, y, width, height);
        context.lineWidth = 3;
        context.strokeStyle = "red";
        context.stroke();

        // Add a background for text
        context.fillStyle = "rgba(255, 0, 0, 0.5)";
        context.fillRect(
          x,
          y > 20 ? y - 20 : y,
          context.measureText(label).width + 10,
          20,
        );

        // Draw text
        context.fillStyle = "white";
        context.font = "16px Arial";
        context.fillText(label, x + 5, y > 20 ? y - 5 : y + 15);
      });

      // Check for newly appeared objects that should be announced
      newDetectedObjects.forEach((obj) => {
        // If this object wasn't in the previous frame or it's reappearing after disappearing
        const isNewAppearance = !Array.from(previousObjects).includes(obj);

        // Only announce if it's newly appeared and not already being announced
        if (isNewAppearance && !announcementsRef.current[obj]) {
          announceObject(obj);
        }
      });

      // Check for objects that have disappeared
      const now = Date.now();
      Array.from(previousObjects).forEach((obj) => {
        // If the object is no longer detected
        if (!newDetectedObjects.has(obj)) {
          // Clear any active announcement for this object
          if (announcementsRef.current[obj]) {
            clearTimeout(announcementsRef.current[obj]);
            delete announcementsRef.current[obj];
          }
        }
      });

      // Update current objects
      setCurrentObjects(newDetectedObjects);

      // Debug info update
      if (relevantPredictions.length > 0) {
        setDebugInfo(`Detected ${relevantPredictions.length} relevant objects`);
      } else if (predictions.length > 0) {
        setDebugInfo(`Detected ${predictions.length} objects, none relevant`);
      } else {
        setDebugInfo("No objects detected");
      }
    } catch (error) {
      console.error("Error during detection:", error);
      setDebugInfo(`Detection error: ${error.message}`);
    }

    // Continue detecting
    if (isDetecting) {
      detectionRef.current = requestAnimationFrame(detectObjects);
    }
  };

  // Start/stop detection
  useEffect(() => {
    if (isDetecting && videoReady && model) {
      setDebugInfo("Starting detection loop...");
      detectObjects();
    } else if (!isDetecting) {
      setDebugInfo("Detection stopped");
      if (detectionRef.current) {
        cancelAnimationFrame(detectionRef.current);
        detectionRef.current = null;
      }

      // Clear all announcements
      Object.values(announcementsRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      announcementsRef.current = {};

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    return () => {
      if (detectionRef.current) {
        cancelAnimationFrame(detectionRef.current);
      }

      // Clear all announcements
      Object.values(announcementsRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [isDetecting, model, videoReady]);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">
        Real-Time Object Detection
      </h1>

      <div className="relative w-full h-auto aspect-video overflow-hidden rounded-lg shadow-md mb-4 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {!videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
            Loading camera...
          </div>
        )}

        {/* Debug overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 text-sm">
          {debugInfo}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={toggleDetection}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-400"
          disabled={!videoReady || !model}
        >
          {isDetecting ? "Stop Detection" : "Start Detection"}
        </button>

        <div className="text-sm text-gray-600">
          {model && videoReady && currentObjects.size > 0 ? (
            <span>Detected: {Array.from(currentObjects).join(", ")}</span>
          ) : (
            <span>
              {model
                ? videoReady
                  ? "Ready"
                  : "Waiting for camera"
                : "Loading model"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObjectDetection;
