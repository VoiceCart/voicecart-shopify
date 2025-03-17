/**
 * Creates a voice chat cycle instance that handles continuous speech recognition
 * and text-to-speech (TTS) replies. When a final transcript is received, it calls the
 * async onSendMessage callback (provided externally) to send the message. If a reply
 * is returned, it is spoken via TTS. If the user speaks while TTS is active, TTS is aborted.
 *
 * Callbacks:
 *   - onProcessingStarted: A lifecycle hook (with no arguments) called once per utterance,
 *     before any transcript is processed. (Use this to update your UI.)
 *   - onInterimTranscript: Called with each interim transcript chunk.
 *   - onFinalTranscript: Called with the final transcript.
 *   - onSendMessage: An async function that receives the final transcript and sends the message.
 *                    It must return a Promise resolving to an object (optionally containing a `reply` property).
 *   - onBackendError: Called with an error if sending the message fails.
 *   - onRecognitionError: Called with an error from speech recognition.
 *   - onTTSStart: Called with the text that is about to be spoken.
 *   - onTTSEnd: Called with the text that was spoken when TTS finishes.
 *   - onTTSError: Called with an error if TTS fails.
 *
 * @param {Object} [config={}] - Configuration options and callbacks.
 * @returns {Object} An object exposing two methods:
 *   - start(): Begins the voice chat cycle.
 *   - stop(): Ends the voice chat cycle.
 *
 * @example
 * const voiceChat = createVoiceChatCycle({
 *   onProcessingStarted: () => { showNewMessageBox(); },
 *   onInterimTranscript: chunk => { updateMessageBox(chunk, false); },
 *   onFinalTranscript: transcript => { updateMessageBox(transcript, true); },
 *   onSendMessage: async transcript => {
 *     // Example: send the transcript to your backend.
 *     const response = await fetch('/api/voiceMessage', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ message: transcript })
 *     });
 *     return response.json(); // Expected to return an object with a `reply` property.
 *   },
 *   onBackendError: error => { console.error("Backend error:", error); },
 *   onRecognitionError: error => { console.error("Recognition error:", error); },
 *   onTTSStart: text => { console.log("TTS starting:", text); },
 *   onTTSEnd: text => { console.log("TTS ended:", text); },
 *   onTTSError: error => { console.error("TTS error:", error); }
 * });
 *
 * // Bind these to UI buttons:
 * document.getElementById('startButton').addEventListener('click', voiceChat.start);
 * document.getElementById('stopButton').addEventListener('click', voiceChat.stop);
 */
function createVoiceChatCycle(config = {}) {
  // Destructure callbacks with default implementations.
  const {
    onFinalTranscript = transcript => { console.log("Final transcript:", transcript); },
    onInterimTranscript = chunk => { console.log("Interim transcript:", chunk); },
    onProcessingStarted = () => { console.log("Processing started."); },
    onSendMessage = async message => {
      console.warn("No onSendMessage callback provided. Message:", message);
      return { reply: '' };
    },
    onBackendError = error => { console.error("Backend error:", error); },
    onRecognitionError = error => { console.error("Recognition error:", error); },
    onTTSStart = text => { console.log("TTS started:", text); },
    onTTSEnd = text => { console.log("TTS ended:", text); },
    onTTSError = error => { console.error("TTS error:", error); }
  } = config;

  // Internal state variables (encapsulated in the closure).
  let active = false;
  let recognitionInstance = null;
  let isTTSActive = false;
  let currentUtterance = null;
  let utteranceStarted = false; // Indicates if processing has started for the current utterance.

  // Check for Speech Recognition API support.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error("Speech Recognition API is not supported in this browser.");
  }

  /**
   * Uses the Speech Synthesis API to speak the given text.
   * @param {string} text - The reply text to be spoken.
   */
  function speakReply(text) {
    if (!('speechSynthesis' in window)) {
      console.error("Speech Synthesis API is not supported in this browser.");
      return;
    }
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = currentLanguage;
    isTTSActive = true;
    onTTSStart(text);

    currentUtterance.onend = function () {
      isTTSActive = false;
      currentUtterance = null;
      onTTSEnd(text);
    };

    currentUtterance.onerror = function (e) {
      isTTSActive = false;
      currentUtterance = null;
      onTTSError(e.error);
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  /**
   * Starts the voice chat cycle by initializing and starting the Speech Recognition instance.
   * Processes interim and final results. When a final transcript is received, it calls the async
   * onSendMessage callback. If a reply is returned, it is spoken via TTS.
   */
  function startCycle() {
    if (active) {
      console.log("Voice chat cycle is already active.");
      return;
    }
    active = true;
    utteranceStarted = false; // Reset for a new utterance.

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;      // Keep listening while active.
    recognitionInstance.interimResults = true;    // Enable interim results.
    recognitionInstance.lang = currentLanguage;

    recognitionInstance.onresult = function (event) {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        // Call the processing-started hook once per utterance.
        if (!utteranceStarted) {
          onProcessingStarted();
          utteranceStarted = true;
        }

        if (!result.isFinal) {
          onInterimTranscript(transcript);
        } else {
          onFinalTranscript(transcript);
          // Reset the flag for the next utterance.
          utteranceStarted = false;

          // Cancel any active TTS before sending a new message.
          if (isTTSActive) {
            window.speechSynthesis.cancel();
            isTTSActive = false;
          }

          // Use the async onSendMessage callback.
          (async () => {
            try {
              const data = await onSendMessage(transcript);
              if (data.reply) {
                speakReply(data.reply);
              } else {
                console.warn("No reply received from onSendMessage.");
              }
            } catch (error) {
              onBackendError(error);
            }
          })();
        }
      }
    };

    // Abort any ongoing TTS when the user starts speaking.
    recognitionInstance.onspeechstart = function () {
      if (isTTSActive) {
        window.speechSynthesis.cancel();
        isTTSActive = false;
      }
    };

    recognitionInstance.onerror = function (event) {
      onRecognitionError(event.error);
    };

    // If recognition ends unexpectedly, restart it.
    recognitionInstance.onend = function () {
      if (active) {
        recognitionInstance.start();
      }
    };

    recognitionInstance.start();
    console.log("Voice chat cycle started.");
  }

  /**
   * Stops the voice chat cycle by stopping speech recognition and canceling any ongoing TTS.
   */
  function stopCycle() {
    active = false;
    if (recognitionInstance) {
      recognitionInstance.stop();
      recognitionInstance = null;
    }
    if (isTTSActive) {
      window.speechSynthesis.cancel();
      isTTSActive = false;
    }
    console.log("Voice chat cycle stopped.");
  }

  // Expose the start and stop methods.
  return { start: startCycle, stop: stopCycle };
}

/* ===== Example Usage =====
   const voiceChat = createVoiceChatCycle({
     onProcessingStarted: () => { showNewMessageBox(); },
     onInterimTranscript: chunk => { updateMessageBox(chunk, false); },
     onFinalTranscript: transcript => { updateMessageBox(transcript, true); },
     onSendMessage: async transcript => {
       // Send the transcript to your backend.
       const response = await fetch('/api/voiceMessage', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: transcript })
       });
       return response.json(); // Expected to return an object with a `reply` property.
     },
     onBackendError: error => { console.error("Backend error:", error); },
     onRecognitionError: error => { console.error("Recognition error:", error); },
     onTTSStart: text => { console.log("TTS starting:", text); },
     onTTSEnd: text => { console.log("TTS finished:", text); },
     onTTSError: error => { console.error("TTS error:", error); }
   });

   // Example: attach start/stop methods to buttons.
   document.getElementById('startButton').addEventListener('click', voiceChat.start);
   document.getElementById('stopButton').addEventListener('click', voiceChat.stop);
================================= */
