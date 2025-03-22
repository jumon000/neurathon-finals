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

export default speak;
