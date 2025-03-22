"use client";
const speak = (text, rate, pitch) => {
  // Only use window when in the browser
  if (typeof window !== "undefined") {
    const synth = window.speechSynthesis;
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.pitch = pitch;
    utterThis.rate = rate;
    synth.speak(utterThis);
  }
};

const getSpeechParams = (emotion) => {
  switch (emotion) {
    case "happy":
      return { rate: 1.2, pitch: 1.2 };
    case "sad":
      return { rate: 0.8, pitch: 0.8 };
    case "angry":
      return { rate: 1.5, pitch: 1.0 };
    default:
      return { rate: 1.0, pitch: 1.0 };
  }
};

export { speak, getSpeechParams };
