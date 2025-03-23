"use client";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import {
  recognition,
  readCommands,
  travelCommands,
  SpeechRecognitionEvent,
} from "@/speech/speechRecognition";

export default function Home() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!recognition) {
      console.error("SpeechRecognition is not supported in this browser.");
      return;
    }

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.trim();
      console.log("Heard:", command);
      const normalizedCommand = command.toLowerCase();
      const normalizedReadCommands = readCommands.map((cmd) =>
        cmd.toLowerCase(),
      );
      const normalizedTravelCommands = travelCommands.map((cmd) =>
        cmd.toLowerCase(),
      );
      console.log("Normalized command:", normalizedCommand);
      console.log("Checking against:", normalizedReadCommands);
      if (normalizedReadCommands.includes(normalizedCommand)) {
        console.log("Match found! Redirecting...");
        redirect("/read-book");
      } else if (normalizedTravelCommands.includes(normalizedCommand)) {
        redirect("/travel");
      } else {
        console.log("Command not recognized:", command);
      }
    };

    setIsReady(true);

    return () => {
      if (recognition) {
        recognition.onresult = null; // Clean up event handler
      }
    };
  }, []);

  const handleStart = () => {
    if (recognition && isReady) {
      console.log("Starting recognition...");
      recognition.start();
    } else {
      console.log(
        "Speech recognition is not yet initialized or not supported.",
      );
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col items-center justify-center p-5">
      <h1 className="text-blue-900 text-4xl mb-5 font-sans">
        Welcome to My App
      </h1>
      <div>
        <button
          onClick={handleStart}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-lg cursor-pointer hover:bg-blue-500 transition-colors duration-300"
        >
          Start your assistant
        </button>
      </div>
    </div>
  );
}
