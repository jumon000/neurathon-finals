// @/speech/speechRecognition.js
"use client";

let SpeechRecognition, SpeechGrammarList, SpeechRecognitionEvent;

if (typeof window !== "undefined") {
  SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  SpeechGrammarList =
    window.SpeechGrammarList || window.webkitSpeechGrammarList;
  SpeechRecognitionEvent =
    window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;
}

const readCommands = ["read a book", "book", "read", "i want to read a book"]; // Lowercase for consistency
const travelCommands = [
  "go outside",
  "I want to go outside",
  "outside",
  "travel",
  "I want to travel",
];
export const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  const speechRecognitionList = new SpeechGrammarList();
  recognition.grammars = speechRecognitionList;
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log("Speech recognition started");
  };

  recognition.onaudiostart = () => {
    console.log("Audio capture started");
  };

  recognition.onspeechend = () => {
    console.log("Speech ended");
    recognition.stop();
  };

  recognition.onnomatch = () => {
    console.log("I didn't recognize that command.");
  };

  recognition.onerror = (event) => {
    console.log(`Error occurred in recognition: ${event.error}`);
  };
}

// Export the commands for use in page.tsx
export { readCommands, travelCommands, SpeechRecognitionEvent };
