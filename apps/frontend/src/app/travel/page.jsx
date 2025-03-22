"use client";
import React, { useEffect, useRef, useState } from "react";
import { speak, getSpeechParams } from "@/speech/speechSynthesis.js";

export default function CameraGuide() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [detectionResults, setDetectionResults] = useState(null);

  // Start camera and WebSocket
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    let animationFrameId;

    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        setCameraStarted(true);
      };
    }

    startCamera();

    // WebSocket setup
    wsRef.current = new WebSocket("ws://localhost:8000/ws/detect-objects");
    wsRef.current.onopen = () => console.log("WebSocket connected");
    wsRef.current.onmessage = (event) => {
      const result = JSON.parse(event.data);
      setDetectionResults(result);
    };
    wsRef.current.onclose = () => console.log("WebSocket disconnected");

    // Stream frames
    const streamFrames = () => {
      if (
        !cameraStarted ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      ) {
        animationFrameId = requestAnimationFrame(streamFrames);
        return;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5); // Lower quality to reduce bandwidth
      const base64Data = dataUrl.split(",")[1];
      wsRef.current.send(base64Data);

      // Draw results if available
      if (detectionResults && detectionResults.box) {
        const [x1, y1, x2, y2] = detectionResults.box;
        ctx.strokeStyle = "green";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = "green";
        ctx.font = "16px Arial";
        ctx.fillText(
          `${detectionResults.class} (${detectionResults.confidence.toFixed(2)}, ${detectionResults.depth.toFixed(1)} cm)`,
          x1,
          y1 - 10,
        );
      }
      animationFrameId = requestAnimationFrame(streamFrames);
    };
    streamFrames();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (wsRef.current) wsRef.current.close();
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStarted, detectionResults]);

  // Optional narration
  useEffect(() => {
    if (detectionResults && detectionResults.class) {
      const text = `${detectionResults.class} detected at ${detectionResults.depth.toFixed(1)} centimeters`;
      speak(text, 1.0, 1.0); // Adjust with emotion if available
    }
  }, [detectionResults]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Real-Time Object Detection</h1>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="max-w-md" />
      {detectionResults && (
        <div className="mt-4 p-4 bg-white rounded shadow max-w-md">
          <p>Class: {detectionResults.class}</p>
          <p>Confidence: {detectionResults.confidence.toFixed(2)}</p>
          <p>Depth: {detectionResults.depth.toFixed(1)} cm</p>
        </div>
      )}
    </div>
  );
}
