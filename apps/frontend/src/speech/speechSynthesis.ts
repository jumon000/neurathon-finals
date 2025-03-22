export const welcomeNote = () => {
  // Only use window when in the browser
  if (typeof window !== "undefined") {
    const synth = window.speechSynthesis;
    const text =
      "Welcome, do you want to read a book? Or do you want to travel the world?";
    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.pitch = 1;
    utterThis.rate = 1;
    synth.speak(utterThis);
  }
};
