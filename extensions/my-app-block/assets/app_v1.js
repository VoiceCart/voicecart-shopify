// ===================== Imports and Initializations =====================

// Imports from your other scripts
const navigationEngine = getScreenSwapper();
const messageFactory = getMessageFactory();

// The different kinds of message senders
const MessageSender = {
  customer: "customer",
  bot: "bot"
};

// ===================== Variable Declarations =====================

// A flag to track if a request is being processed
let isProcessing = false;

// Keep reference to the current fetch AbortController
let currentFetchController = null;

// Keep track of the last query
let lastMessageText = null;

let currentGroup = null;
let lastSender = null;
let currentLanguageKey = null;  // Will be set on DOMContentLoaded
let currentLanguage = null;

const languageMap = {
  en: "en-US",
  ru: "ru-RU",
  de: "de-DE",
  cz: "cs-CZ"
};

// Map of constant messages for every language.
const constantMessages = {
  greeting: {
    en: "Hi! My name is Eva and I'm here to assist you with shopping, managing your cart, applying discounts, and checking out 😊",
    ru: "Привет! Меня зовут Eva, я здесь, чтобы помочь вам с покупками, управлением корзиной, применением скидок и оформлением заказа 😊",
    de: "Hallo! Mein Name ist Eva und ich helfe Ihnen beim Einkaufen, Verwalten Ihres Warenkorbs, Anwenden von Rabatten und Auschecken 😊",
    cs: "Ahoj! Jmenuji se Eva a jsem tu, abych vám pomohla s nákupem, správou košíku, uplatněním slev a dokončením objednávky 😊"
  },
  errorServer: {
    en: "Server error. Turn on the server and try again.",
    ru: "Ошибка сервера. Включите сервер и попробуйте снова.",
    de: "Serverfehler. Bitte schalten Sie den Server ein und versuchen Sie es erneut.",
    cs: "Chyba serveru. Zapněte server a zkuste to znovu."
  },
  consentInstruction: {
    en: "We use cookies to enhance your experience. Please check the box to consent.",
    ru: "Мы используем файлы cookie для улучшения вашего опыта. Пожалуйста, поставьте галочку, чтобы дать согласие.",
    de: "Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Bitte setzen Sie ein Häkchen, um zuzustimmen.",
    cs: "Používáme cookies ke zlepšení vašeho zážitku. Prosím, zaškrtněte políčko pro souhlas."
  },
  consentSuccess: {
    en: "Thank you for accepting cookies! How can I assist you today?",
    ru: "Спасибо за согласие на использование cookies! Чем я могу вам помочь?",
    de: "Danke, dass Sie Cookies zugestimmt haben! Wie kann ich Ihnen helfen?",
    cs: "Děkujeme za souhlas s cookies! Jak vám mohu pomoci?"
  },
  consentError: {
    en: "Sorry, but we can't work without your consent to use cookies.",
    ru: "Извините, но мы не можем работать без вашего согласия на использование cookies.",
    de: "Entschuldigung, aber wir können nicht ohne Ihre Zustimmung zu Cookies arbeiten.",
    cs: "Omlouváme se, ale bez vašeho souhlasu s cookies nemůžeme pracovat."
  },
  // New keys for cancel chat confirmation
  endChatConfirmation: {
    en: "Are you sure you want to end the chat?",
    ru: "Вы уверены, что хотите завершить чат?",
    de: "Sind Sie sicher, dass Sie den Chat beenden möchten?",
    cs: "Opravdu chcete ukončit chat?"
  },
  endChatYes: {
    en: "Yes",
    ru: "Да",
    de: "Ja",
    cs: "Ano"
  },
  endChatNo: {
    en: "No",
    ru: "Нет",
    de: "Nein",
    cs: "Ne"
  }
};

// ===================== Helper Functions =====================

let lastAppliedDiscountCode = null;

// Add a function to generate the checkout URL using Shopify Storefront API
async function generateCheckoutUrl(discountCode = null) {
  try {
    // Fetch the current cart to check if it's empty
    const cart = await getCartState();
    if (cart.item_count === 0) {
      throw new Error("Cart is empty. Add items before checking out.");
    }

    // Get session_id from cookie
    const sessionId = getOwnCookie("_eva_sid");
    if (!sessionId) {
      throw new Error("Session ID not found. Please start a new chat.");
    }

    // Add session_id as a cart attribute
    const response = await fetch(window.Shopify.routes.root + 'cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attributes: {
          "voicecart_session_id": sessionId // This will appear in order.note_attributes
        }
      })
    });
    const updateResult = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to update cart attributes: ${updateResult.description || 'Unknown error'}`);
    }

    // Shopify's checkout URL is typically at the /checkout endpoint
    const storeDomain = window.Shopify.shop || 'getvoicecart.myshopify.com';
    let checkoutUrl = `https://${storeDomain}/checkout`;

    // Append discount code if provided
    if (discountCode) {
      checkoutUrl += `?discount=${encodeURIComponent(discountCode)}`;
    }

    console.log("Generated checkout URL with session_id in cart attributes:", checkoutUrl);
    return checkoutUrl;
  } catch (error) {
    console.error("Error generating checkout URL:", error);
    throw error;
  }
}

// Add this new function to apply discount codes
async function applyDiscountCode(discountCode) {
  try {
    const response = await fetch(window.Shopify.routes.root + 'cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        discount: discountCode
      })
    });
    const result = await response.json();
    console.log("applyDiscountCode response:", result); // Log Shopify's response
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} - ${result.description || 'Unknown error'}`);
    }
    return result;
  } catch (error) {
    console.error("Error applying discount code:", error);
    throw error;
  }
}

/**
 * Fetches the current cart state from Shopify.
 * Returns the full cart object.
 */
async function getCartState() {
  try {
    const response = await fetch(window.Shopify.routes.root + 'cart.js', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const cart = await response.json();
    return cart;
  } catch (error) {
    console.error("Error fetching cart state:", error);
    return { items: [], item_count: 0, total_price: 0, total_discount: 0 };
  }
}

/**
 * Displays the current cart contents in the chat.
 */
async function sendCartSummaryToChat() {
  const cart = await getCartState();
  if (cart.item_count === 0) {
    sendMessageToAChat(MessageSender.bot, {
      message: "Your cart is empty.",
      emotion: "neutral"
    });
  } else {
    let summary = `Your cart has ${cart.item_count} item(s):\n`;
    cart.items.forEach((item, index) => {
      const itemPrice = (item.price / 100).toFixed(2); // Convert cents to dollars
      summary += `${index + 1}. ${item.title} - Quantity: ${item.quantity}, Price: ${itemPrice} ${cart.currency} each\n`;
    });
    
    const totalPrice = (cart.total_price / 100).toFixed(2);
    const totalDiscount = (cart.total_discount / 100).toFixed(2);
    
    summary += `\nTotal Price: ${totalPrice} ${cart.currency}`;
    if (totalDiscount > 0) {
      summary += `\nDiscount Applied: ${totalDiscount} ${cart.currency} saved`;
    }
    
    sendMessageToAChat(MessageSender.bot, {
      message: summary,
      emotion: "welcoming"
    });
  }
}

/**
 * Manages the set of executed actions in localStorage, scoped by sessionId.
 */
function manageExecutedActions(sessionId) {
  const storageKey = `executedActions_${sessionId}`;
  
  return {
    get: () => {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    },
    add: (actionKey) => {
      const executedActions = manageExecutedActions(sessionId).get();
      executedActions.add(actionKey);
      localStorage.setItem(storageKey, JSON.stringify([...executedActions]));
    },
    clear: () => {
      localStorage.removeItem(storageKey);
    }
  };
}

/**
 * Fetches the current cart state from Shopify.
 * Returns the quantity of the specified variantId in the cart, or 0 if not found.
 */
async function getCartQuantity(variantId) {
  try {
    const response = await fetch(window.Shopify.routes.root + 'cart.js', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const cart = await response.json();
    const item = cart.items.find(item => item.variant_id === Number(variantId));
    return item ? item.quantity : 0;
  } catch (error) {
    console.error("Error fetching cart state:", error);
    return 0;
  }
}

/**
 * Iterates over all elements tagged with a constant message and updates their text based on the new language.
 */
function updateConstantMessages() {
  const constantElements = document.querySelectorAll("[data-constant-key]");
  constantElements.forEach(el => {
    const key = el.getAttribute("data-constant-key");
    const newText = constantMessages[key] && constantMessages[key][currentLanguageKey]
      ? constantMessages[key][currentLanguageKey]
      : (constantMessages[key] && constantMessages[key]["en"]) || "";
    // If the element contains a specific content child (for bot messages), update that.
    const contentEl = el.querySelector(".chat-bot-message-content");
    if (contentEl) {
      contentEl.textContent = newText;
    } else {
      el.textContent = newText;
    }
  });
}

function checkAndSendGreeting() {
  const chatView = document.querySelector("#chat-view");
  // Check if the chat view has no non-whitespace content
  if (!chatView.innerHTML.trim()) {
    insertTimelineIfNotExists();
    sendMessageToAChat(MessageSender.bot, {
      message: constantMessages.greeting[currentLanguageKey],
      emotion: "welcoming"
    });
  }
}

/**
 * Initializes the loader by checking the session state.
 */
async function initLoader() {
  const chatView = document.querySelector("#chat-view");
  const evaCookie = getOwnCookie("_eva_sid");
  if (evaCookie) {
    if (!chatView.classList.contains("rendered")) {
      navigationEngine.goToChat();
      try {
        const sessionState = await fetchSessionState();
        console.log("Session state: ", sessionState);

        if (sessionState && sessionState.length > 0) {
          await renderChatHistory(sessionState, evaCookie);
        } else {
          checkAndSendGreeting();
        }

        // Reveal footer & dropdown only if we have a valid session
        const footer = document.querySelector("#eva-chat-footer");
        footer.classList.remove("invisible");
      } catch {
        // Use the localized server error message
        sendMessageToAChat(MessageSender.bot, {
          message: constantMessages.errorServer[currentLanguageKey],
          emotion: "sleeping",
          customClass: "error-message",
          constantKey: "errorServer"
        });
      }
    } else {
      checkAndSendGreeting();
    }
    chatView.classList.add("rendered");
  } else {
    navigationEngine.goToChat();
    startNewChat();
    // Use the localized greeting if the chat view is empty.
  }
}

let stopVoiceCycle = null;

/**
 * Initializes all UI event listeners (once the DOM is loaded).
 */
async function initListeners(navigationEngine, messageFactory) {
  // Attach .btn triggers
  const btns = document.querySelectorAll(".btn:not(.btn-without-sending-query)");
  for (const btn of btns) {
    btn.onclick = async (e) => {
      handleUserQuery(e.target.innerText);
    };
  }

  // Bubble button -> show chat
  const evaBubbleButton = document.querySelector(".eva-bubble-button");
  evaBubbleButton.addEventListener("click", async () => {
    const chatWrapper = document.querySelector("#eva-assistant");
    if (chatWrapper.classList.contains("invisible")) {
      evaBubbleButton.classList.add("invisible");
      fadeIn(chatWrapper);
      await initLoader();
    } else {
      fadeOut(chatWrapper);
    }
  });

  // Attach the cancel chat listener (for ending the chat)
  const cancelChatButton = document.querySelector("#cancel-chat-button");
  if (cancelChatButton) {
    cancelChatButton.addEventListener("click", openCancelChatModal);
  }

  // Fold chat button (close/hide)
  const foldChatButton = document.querySelector(".fold-button-wrapper");
  foldChatButton.addEventListener("click", async () => {
    const chatWrapper = document.querySelector("#eva-assistant");
    const evaBubbleButton = document.querySelector(".eva-bubble-button");
    if (!chatWrapper.classList.contains("invisible")) {
      fadeOut(chatWrapper);
      await new Promise(r => setTimeout(r, 300));
      fadeIn(evaBubbleButton);
    } else {
      fadeIn(chatWrapper);
    }
  });

  // --- Attach listeners for the custom dropdown ---
  const customDropdown = document.querySelector(".custom-dropdown");
  if (customDropdown) {
    const dropdownSelected = customDropdown.querySelector(".dropdown-selected");
    const dropdownList = customDropdown.querySelector(".dropdown-list");
    const dropdownItems = customDropdown.querySelectorAll(".dropdown-item");

    // Initialize the displayed language
    if (!currentLanguageKey) {
      currentLanguageKey = "en";
      currentLanguage = languageMap["en"];
    }
    dropdownSelected.textContent =
      currentLanguageKey.charAt(0).toUpperCase() + currentLanguageKey.slice(1);

    // Toggle the dropdown on click
    customDropdown.addEventListener("click", () => {
      dropdownList.style.display =
        dropdownList.style.display === "block" ? "none" : "block";
    });

    // Update selected language when an item is clicked
    dropdownItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedShort = item.getAttribute("data-short");
        dropdownSelected.textContent = selectedShort;

        const newLangKey = item.getAttribute("data-value");
        currentLanguageKey = newLangKey;
        currentLanguage = languageMap[newLangKey];
        console.log("Language changed to:", currentLanguage);

        dropdownList.style.display = "none";
        setCookie("_eva_language", newLangKey, 365);
        // Update any constant messages already in the UI
        updateConstantMessages();
      });
    });

    // Hide the dropdown if clicked outside
    document.addEventListener("click", (e) => {
      if (!customDropdown.contains(e.target)) {
        dropdownList.style.display = "none";
      }
    });
  }

  const helpButton = document.querySelector("#help-button");
  if (helpButton) {
    helpButton.addEventListener("click", openHelpPopup);
  }

  // Add these listeners so the red cross & back arrow actually exit voice mode:
  const backTextBtn = document.querySelector("#back-text");
  if (backTextBtn) {
    backTextBtn.addEventListener("click", () => {
      if (stopVoiceCycle) {
        stopVoiceCycle();
        navigationEngine.goToTextInput();
      }
    });
  }
  const cancelVoiceBtn = document.querySelector("#cancel-voice");
  if (cancelVoiceBtn) {
    cancelVoiceBtn.addEventListener("click", () => {
      if (stopVoiceCycle) {
        stopVoiceCycle();
        navigationEngine.goToTextInput();
      }
    });
  }

  // Query input & send button
  const queryInput = document.querySelector("#query-input");
  const sendButton = document.querySelector("#send-query-button");

  // Initial grey state if empty
  sendButton.classList.toggle("greyed-out", !queryInput.value.trim());

  // Input validation
  queryInput.addEventListener("input", () => {
    const hasText = queryInput.value.trim().length > 0;
    sendButton.classList.toggle("greyed-out", !hasText);
  });

  // Send button
  sendButton.onclick = async () => {
    const messageText = queryInput.value;
    await handleUserQuery(messageText);
  };

  // Press Enter -> send
  queryInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const messageText = queryInput.value;
      await handleUserQuery(messageText);
    }
  });

  // Voice button
  const voiceButton = document.querySelector("#record-voice-button");
  let textParagraph = null;

  // Check for Speech Recognition API support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSpeechRecognitionSupported = !!SpeechRecognition;

  // Create voice chat cycle
  const voiceChatCycle = createVoiceChatCycle({
    onProcessingStarted: () => {
      // Create a temporary UI element to show interim transcripts, but don't append it as a message yet
      const messageBox = document.createElement("div");
      messageBox.classList.add("chat-customer-message", "voice-temp");
      messageBox.innerHTML = `<div class="chat-customer-message-content"></div>`;
      navigationEngine.getCurrentView().appendChild(messageBox);
      textParagraph = messageBox.querySelector(".chat-customer-message-content");
      scrollChatToBottom();
    },
  
    onInterimTranscript: (chunk) => {
      if (textParagraph) {
        textParagraph.innerHTML = chunk;
      }
    },
  
    onFinalTranscript: (transcript) => {
      if (textParagraph) {
        textParagraph.innerHTML = transcript;
      }
    },
  
    onRecognitionError: (error) => {
      console.error("Recognition error:", error);
      // Remove the temporary message on error
      const tempMessage = document.querySelector(".voice-temp");
      if (tempMessage) tempMessage.remove();
    },
  
    onSendMessage: async (transcript) => {
      // Check if a request is already in progress
      if (isProcessing) {
        console.log("Request already in progress, ignoring voice message:", transcript);
        const tempMessage = document.querySelector(".voice-temp");
        if (tempMessage) tempMessage.remove();
        return { reply: "" };
      }

      // Remove the temporary voice message
      const tempMessage = document.querySelector(".voice-temp");
      if (tempMessage) tempMessage.remove();
      // Pass a custom handler to handleUserQuery to append the message exactly once
      await handleUserQuery(transcript, {
        handle: () => {
          sendMessageToAChat(MessageSender.customer, { message: transcript });
        }
      });
      return { reply: "" };
    },
  
    onBackendError: (error) => {
      console.error("Backend error:", error);
      // Remove the temporary message on error
      const tempMessage = document.querySelector(".voice-temp");
      if (tempMessage) tempMessage.remove();
    },
  
    onTTSStart: (text) => {
      console.log("TTS started:", text);
    },
  
    onTTSEnd: (text) => {
      console.log("TTS ended:", text);
    },
  
    onTTSError: (error) => {
      console.error("TTS error:", error);
    }
  });

  // Assign startVoiceCycle and stopVoiceCycle to be accessible
  const startVoiceCycle = voiceChatCycle.start;
  stopVoiceCycle = voiceChatCycle.stop;

  voiceButton.addEventListener("click", async () => {
    if (isProcessing) {
      console.log("Request in progress, voice input disabled.");
      return;
    }
  
    // Debug logging to help troubleshoot
    console.log("Voice button clicked");
    
    // Make sure we have the chat container to add messages to
    const chatContainer = document.querySelector("#chat-view") || document.querySelector(".chat-messages-container");
    if (!chatContainer) {
      console.error("Could not find chat container");
      return;
    }
  
    // First create a direct DOM element for browser support message if needed
    const createErrorMessage = (message) => {
      // Try the proper way first
      try {
        sendMessageToAChat(MessageSender.bot, {
          message: message,
          emotion: "sad",
          customClass: "error-message"
        });
      } catch (err) {
        // Fallback if sendMessageToAChat fails
        console.error("Error in sendMessageToAChat:", err);
        
        // Direct DOM manipulation as fallback
        const messageElement = document.createElement("div");
        messageElement.classList.add("chat-bot-message", "error-message");
        messageElement.innerHTML = `
          <div class="chat-bot-avatar sad"></div>
          <div class="chat-bot-message-content">${message}</div>
        `;
        chatContainer.appendChild(messageElement);
      }
      
      // Try both scrolling methods to ensure visibility
      try {
        scrollChatToBottom();
      } catch (err) {
        console.error("Error in scrollChatToBottom:", err);
        // Fallback scrolling
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    };
  
    // Specifically detect Firefox
    if (navigator.userAgent.toLowerCase().includes("firefox")) {
      console.log("Firefox detected, showing message");
      createErrorMessage("Firefox does not support voice mode. Please use Chrome or another compatible browser.");
      return;
    }
  
    // Check for Speech Recognition support in other browsers
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not supported, showing message");
      createErrorMessage("Your browser does not support voice mode. Please use Chrome or another compatible browser.");
      return;
    }
  
    // Request audio permission only when voice mode is activated
    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      navigationEngine.goToVoiceInput();
      navigationEngine.goToChat();
      startVoiceCycle();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // Create more robust microphone access error message
      createErrorMessage("Microphone access is required for voice mode. Please allow access to continue.");
    }
  });
}

/**
 * Main function to handle user input flow, including showing "Responding..." & possible abort.
 */
async function handleUserQuery(messageText, options) {
  // Prevent new queries if a request is already in progress
  if (isProcessing) {
    console.log("Request already in progress, ignoring new query:", messageText);
    return;
  }

  const handler =
    options?.handle ||
    (() => {
      sendMessageToAChat(MessageSender.customer, { message: messageText });
    });

  if (!messageText.trim().length) {
    return;
  }

  const sessionId = getOwnCookie("_eva_sid");
  if (!sessionId) {
    showConsentBubble();
    return;
  }

  lastMessageText = messageText;
  handler();
  disableInputBar();
  showThinkingBubble(50000);
  const thinkingBubble = document.querySelector(".thinking-message");

  const controller = new AbortController();
  currentFetchController = controller;
  isProcessing = true; // Set flag to lock input

  try {
    const cartState = await getCartState(); // Fetch cart state for context
    const receivedMessage = await fetchMessage(messageText.trim(), controller.signal);
    if (thinkingBubble) thinkingBubble.remove();

    // Track the last action to deduplicate consecutive identical actions
    let lastActionKey = null;

    console.log(`Processing ${receivedMessage.messages.length} messages from response`);
    for (let message of receivedMessage.messages) {
      if (message.type === "message") {
        sendMessageToAChat(MessageSender.bot, {
          message: message.value,
          emotion: "welcoming"
        });
      } else if (message.type === "products") {
        await sendProductListToAChat(message.value);
      } else if (message.type === "action") {
        const action = message.value;
        // Generate a key for the action to check for duplicates
        const actionKey = `${action.action}-${action.variantId || 'no-variant'}-${action.quantity || 0}`;
        if (actionKey === lastActionKey) {
          console.log(`Skipping duplicate action: ${actionKey}`);
          continue; // Skip duplicate consecutive actions
        }
        lastActionKey = actionKey;

        if (action.action === "addToCart") {
          try {
            const currentQuantity = cartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
            const desiredQuantity = Number(action.quantity); // Treat as total desired quantity
            const quantityToAdd = desiredQuantity - currentQuantity;
            if (quantityToAdd > 0) {
              await cartActions.addToCart({
                variantId: action.variantId,
                quantity: quantityToAdd,
              });
              console.log(`Added ${quantityToAdd} units of item with variantId ${action.variantId} to cart. Desired total quantity: ${desiredQuantity}`);
              // Validate cart state after adding
              const updatedCartState = await getCartState();
              const actualQuantity = updatedCartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
              if (actualQuantity !== desiredQuantity) {
                console.error(`Cart quantity mismatch: Expected ${desiredQuantity}, but found ${actualQuantity} for variantId ${action.variantId}`);
                sendMessageToAChat(MessageSender.bot, {
                  message: `There was an issue updating the cart. Expected ${desiredQuantity} items, but found ${actualQuantity}. Please check your cart.`,
                  emotion: "sad",
                  customClass: "error-message"
                });
              }
            } else {
              console.log(`#pragma once
No additional units added. Cart already has ${currentQuantity} units of variantId ${action.variantId}, desired ${desiredQuantity}`);
            }
          } catch (error) {
            console.error("Error adding item to cart:", error);
            sendMessageToAChat(MessageSender.bot, {
              message: "Sorry, I couldn’t add the item to your cart. Please try again later.",
              emotion: "sad",
              customClass: "error-message"
            });
          }
        } else if (action.action === "removeFromCart") {
          try {
            const currentQuantity = cartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
            const newQuantity = Number(action.quantity);
            if (currentQuantity > 0) {
              await cartActions.removeFromCart({
                variantId: action.variantId,
                quantity: newQuantity,
              });
              console.log(`Set quantity of item with variantId ${action.variantId} to ${newQuantity} in cart`);
            } else {
              console.log(`Item with variantId ${action.variantId} not in cart, skipping remove`);
            }
          } catch (error) {
            console.error("Error removing item from cart:", error);
            sendMessageToAChat(MessageSender.bot, {
              message: "Sorry, I couldn’t remove the item from your cart. Please try again later.",
              emotion: "sad",
              customClass: "error-message"
            });
          }
        } else if (action.action === "clearCart") {
          try {
            await cartActions.clearCart();
            console.log("Cart cleared successfully");
            sendMessageToAChat(MessageSender.bot, {
              message: "Your cart has been cleared.",
              emotion: "neutral"
            });
          } catch (error) {
            console.error("Error clearing cart:", error);
            sendMessageToAChat(MessageSender.bot, {
              message: "Sorry, I couldn’t clear your cart. Please try again later.",
              emotion: "sad",
              customClass: "error-message"
            });
          }
        } else if (action.action === "applyDiscount") {
          try {
            const originalTotal = cartState.total_price;
            console.log("Original cart state before applying discount:", cartState);
            await applyDiscountCode(action.discountCode);
            const updatedCart = await getCartState();
            console.log("Updated cart state after applying discount:", updatedCart);
            const discountAmount = ((originalTotal - updatedCart.total_price) / 100).toFixed(2);
            if (discountAmount <= 0) {
              throw new Error("Discount didn’t reduce the total price.");
            }
            lastAppliedDiscountCode = action.discountCode; // Store the discount code
            sendMessageToAChat(MessageSender.bot, {
              message: `Discount code "${action.discountCode}" applied! You saved ${discountAmount} ${updatedCart.currency}.`,
              emotion: "welcoming"
            });
          } catch (error) {
            console.error("Error applying discount code:", error.message);
            sendMessageToAChat(MessageSender.bot, {
              message: `Sorry, I couldn’t apply the discount code: ${error.message}. Please check the code and try again.`,
              emotion: "sad",
              customClass: "error-message"
            });
          }
        } else if (action.action === "checkoutCart") {
          try {
            // Show cart summary before proceeding to checkout
            await sendCartSummaryToChat();
            const discountCode = action.discountCode || lastAppliedDiscountCode;
            const checkoutUrl = await generateCheckoutUrl(discountCode);
            // Make the URL clickable by wrapping it in an <a> tag
            sendMessageToAChat(MessageSender.bot, {
              message: `Ready to checkout? Click here: <a href="${checkoutUrl}" target="_blank">${checkoutUrl}</a>`,
              emotion: "welcoming"
            });
          } catch (error) {
            console.error("Error generating checkout URL:", error.message);
            sendMessageToAChat(MessageSender.bot, {
              message: `Sorry, I couldn’t generate the checkout link: ${error.message}. Please try again.`,
              emotion: "sad",
              customClass: "error-message"
            });
          }
        }
      } else if (message.type === "cartSummary") {
        await sendCartSummaryToChat();
      }
      scrollChatToBottom();
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("User aborted request.");
    } else if (err.response && err.response.status === 500) {
      console.error("Server error (500):", err);
      if (thinkingBubble) thinkingBubble.remove();
      sendMessageToAChat(MessageSender.bot, {
        message: constantMessages.errorServer[currentLanguageKey],
        emotion: "sleeping",
        customClass: "error-message",
        constantKey: "errorServer"
      });
      scrollChatToBottom();
    } else {
      console.error("Error fetching message:", err);
      if (thinkingBubble) thinkingBubble.remove();
      sendMessageToAChat(MessageSender.bot, {
        message: "Oops! Something went wrong on our end. Please try again. 😞",
        emotion: "sad",
        customClass: "error-message"
      });
      scrollChatToBottom();
    }
  } finally {
    currentFetchController = null;
    isProcessing = false; // Reset flag to unlock input
    enableInputBar();
  }
}

/**
 * Opens a help popup explaining what the bot can do.
 */
function openHelpPopup() {
  const chatView = document.querySelector("#chat-view");

  // Create an overlay for the modal within #chat-view
  const modalOverlay = document.createElement("div");
  modalOverlay.classList.add("modal-overlay");

  // Create the modal window container
  const modalWindow = document.createElement("div");
  modalWindow.classList.add("modal-window");

  // Help message content
  const helpMessage = document.createElement("div");
  helpMessage.innerHTML = `
    Hello! I'm Eva, your shopping assistant. I can:
    <br><br>
    <ul style="margin-left: 20px;">
    <li>Help you find products and answer shopping-related questions.</li>
    <li>Add items to your cart, remove them, or clear your cart.</li>
    <li>Show you a summary of your cart at any time.</li>
    <li>Apply discount codes to save you money.</li>
    <li>Generate a checkout link when you're ready to buy.</li>
    <li>Support multiple languages (English, Russian, German, Czech).</li>
    </ul>
    <br>
    Use text or voice input to chat with me!
    <br>
  `;
  modalWindow.appendChild(helpMessage);

  // Close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "Back to Chat";
  closeButton.classList.add("modal-close-button");
  modalWindow.appendChild(closeButton);

  modalOverlay.appendChild(modalWindow);
  chatView.appendChild(modalOverlay);

  closeButton.addEventListener("click", () => {
    modalOverlay.remove();
  });
}

/**
 * Displays a consent bubble in the middle of the chat that asks for cookie consent.
 */
function showConsentBubble() {
  const chatView = document.querySelector("#chat-view");
  const consentBubble = document.createElement("div");
  consentBubble.classList.add("consent-bubble");

  const instruction = document.createElement("p");
  // Tag with constantKey for updates
  instruction.dataset.constantKey = "consentInstruction";
  instruction.textContent =
    constantMessages.consentInstruction[currentLanguageKey] ||
    constantMessages.consentInstruction["en"];
  consentBubble.appendChild(instruction);

  const checkboxContainer = document.createElement("div");
  checkboxContainer.classList.add("consent-checkbox-container");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "consent-checkbox";
  checkboxContainer.appendChild(checkbox);

  const checkboxLabel = document.createElement("label");
  checkboxLabel.htmlFor = "consent-checkbox";
  checkboxLabel.textContent = "I consent with cookies";
  checkboxContainer.appendChild(checkboxLabel);

  consentBubble.appendChild(checkboxContainer);

  const startButton = document.createElement("button");
  startButton.classList.add("start-chat-button");
  startButton.textContent = "Start new chat";
  startButton.disabled = true;
  startButton.classList.add("greyed-out");
  consentBubble.appendChild(startButton);

  chatView.appendChild(consentBubble);
  scrollChatToBottom();

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      startButton.disabled = false;
      startButton.classList.remove("greyed-out");
    } else {
      startButton.disabled = true;
      startButton.classList.add("greyed-out");
    }
  });

  startButton.addEventListener("click", () => {
    if (!checkbox.checked) return;
    consentBubble.remove();
    handleConsent(true);
    const footer = document.querySelector("#eva-chat-footer");
    footer.classList.remove("invisible");
  });
}

/**
 * Handles the user's consent response.
 */
function handleConsent(consent) {
  if (consent) {
    const sessionId = generateUUID();
    setCookie("_eva_sid", sessionId, 365);
    // Send the consent success message tagged for constant updates
    checkAndSendGreeting();
    scrollChatToBottom();
    enableInputBar();
  } else {
    sendMessageToAChat(MessageSender.bot, {
      message: constantMessages.consentError[currentLanguageKey],
      emotion: "sad",
      customClass: "error-message",
      constantKey: "consentError"
    });
    scrollChatToBottom();
    disableInputBar("consent");
  }
}

/**
 * Appends product list to the chat.
 */
async function sendProductListToAChat(products) {
  const prefix = crypto.randomUUID();
  const glideMarkup = await generateGlideMarkup(products, prefix);
  appendMessageToGroup("glider", glideMarkup);
  await mountProducts(prefix);
}

/**
 * User clicked "Stop waiting".
 */
async function cancelWaiting() {
  if (currentFetchController) {
    currentFetchController.abort();
    currentFetchController = null;
  }
  enableInputBar();
  if (lastMessageText) {
    await deleteLastMessage(lastMessageText);
  }
  grayOutLastMessageBubble();
}

/**
 * Removes the last message bubble from #chat-view.
 */
function grayOutLastMessageBubble() {
  const chatView = document.querySelector("#chat-view");
  const allMessages = chatView.querySelectorAll(
    ".chat-customer-message, .chat-bot-message-with-pic-wrapper"
  );
  if (allMessages.length > 0) {
    const lastMsg = allMessages[allMessages.length - 1];
    if (!lastMsg.classList.contains("chat-customer-message")) {
      return;
    }
    lastMsg.classList.add("canceled-message");
  }
}

/**
 * Creates and appends a new message bubble to the chat view.
 * If a constantKey is provided, the message bubble is tagged so that its content can be updated when the language changes.
 */
function sendMessageToAChat(sender, config) {
  let messageBubble;
  if (sender === MessageSender.customer) {
    if (config?.mode === "voice") {
      messageBubble = messageFactory.createCustomerMessage("");
    } else {
      const input = document.querySelector("#query-input");
      const textToShow = config?.message ?? input.value;
      if (!textToShow.length) return;
      messageBubble = messageFactory.createCustomerMessage(textToShow);
      input.value = "";
    }
  } else if (sender === MessageSender.bot) {
    messageBubble = messageFactory.createBotMessage(
      config.message,
      config.emotion,
      { customClass: config.customClass || "" }
    );
    // Tag the bubble if it is a constant message
    if (config.constantKey) {
      messageBubble.dataset.constantKey = config.constantKey;
    }
  } else {
    throw new Error("Message type is not defined in sendMessageToAChatFunction");
  }
  messageBubble.classList.add("fade-in");
  appendMessageToGroup(sender, messageBubble);
  return messageBubble;
}

/**
 * Disables the input bar.
 */
function disableInputBar(messageType = "default") {
  const inputBar = document.querySelector("#eva-chat-footer");
  const sendButton = document.querySelector("#send-query-button");
  const voiceButton = document.querySelector("#record-voice-button");
  const cancelButton = document.querySelector("#cancel-waiting-button");
  inputBar.classList.add("greyed-out");

  if (messageType !== "consent") {
    cancelButton.classList.remove("invisible");
    cancelButton.classList.add("visible", "cancel-exception");
    cancelButton.style.pointerEvents = "all";
    cancelButton.style.cursor = "pointer";
    sendButton.classList.add("invisible");
    voiceButton.classList.add("invisible");
  }

  if (!cancelButton.dataset.listenerAttached) {
    cancelButton.addEventListener("click", async () => {
      await cancelWaiting();
    });
    cancelButton.dataset.listenerAttached = "true";
  }
}

/**
 * Re-enables the input bar.
 */
function enableInputBar() {
  const inputBar = document.querySelector("#eva-chat-footer");
  const inputField = document.querySelector("#query-input");
  const sendButton = document.querySelector("#send-query-button");
  const voiceButton = document.querySelector("#record-voice-button");
  const cancelButton = document.querySelector("#cancel-waiting-button");

  cancelButton.classList.add("invisible");
  sendButton.classList.remove("invisible");
  voiceButton.classList.remove("invisible");

  inputBar.style.opacity = "1";
  inputBar.style.pointerEvents = "all";
  inputField.removeAttribute("readonly");
  inputField.style.cursor = "text";
  voiceButton.style.pointerEvents = "all";
  voiceButton.style.cursor = "pointer";
  cancelButton.style.pointerEvents = "none";
  cancelButton.style.cursor = "not-allowed";
}

/**
 * Scrolls the chat to the bottom.
 */
function scrollChatToBottom() {
  const container = document.querySelector("#chat-view");
  container.scrollTop = container.scrollHeight;
}

/**
 * Shows a thinking bubble with animated dots.
 */
function showThinkingBubble(duration = 10000) {
  const thinkingMessage = messageFactory.createBotMessage(".", "thinking");
  thinkingMessage.classList.add("thinking-message", "fade-in");
  navigationEngine.getCurrentView().appendChild(thinkingMessage);
  scrollChatToBottom();

  const contentElement = thinkingMessage.querySelector(".chat-bot-message-content");
  const dots = [".", "..", "..."];
  let currentDotIndex = 0;
  const interval = setInterval(() => {
    contentElement.textContent = dots[currentDotIndex];
    currentDotIndex = (currentDotIndex + 1) % dots.length;
  }, 500);

  setTimeout(() => {
    clearInterval(interval);
    thinkingMessage.remove();
  }, duration);
}

/**
 * Renders the chat history.
 */
async function renderChatHistory(messages, sessionId) {
  const chatView = document.querySelector("#chat-view");
  if (!chatView.classList.contains("rendered")) {
    const executedActions = manageExecutedActions(sessionId);

    for (let message of messages) {
      if (message.sender === "customer") {
        sendMessageToAChat(MessageSender.customer, { message: message.value });
      } else {
        if (message.type === "message") {
          sendMessageToAChat(MessageSender.bot, {
            message: message.value,
            emotion: "welcoming"
          });
        } else if (message.type === "products") {
          await sendProductListToAChat(message.value);
        } else if (message.type === "action") {
          const action = message.value;
          if (!message.createdAt) {
            console.warn("Missing createdAt for action message:", message);
            continue;
          }
          const actionKey = `${action.action}-${action.variantId || 'no-variant'}-${action.quantity || 0}-${message.createdAt}`;
          
          const executedSet = executedActions.get();
          if (executedSet.has(actionKey)) {
            console.log(`Skipping already executed action: ${actionKey}`);
            continue;
          }

          if (action.action === "addToCart") {
            try {
              const cartState = await getCartState();
              const currentQuantity = cartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
              const desiredTotalQuantity = Number(action.quantity); // Desired total quantity in cart
              if (currentQuantity >= desiredTotalQuantity) {
                console.log(`Skipping addToCart: Cart already has ${currentQuantity} units of variantId ${action.variantId}, desired ${desiredTotalQuantity}`);
                executedActions.add(actionKey);
                continue;
              }
              const quantityToAdd = desiredTotalQuantity - currentQuantity;
              await cartActions.addToCart({
                variantId: action.variantId,
                quantity: quantityToAdd,
              });
              console.log(`Added ${quantityToAdd} units of item with variantId ${action.variantId} to cart from history. Total quantity: ${desiredTotalQuantity}`);
              // Validate cart state after adding
              const updatedCartState = await getCartState();
              const actualQuantity = updatedCartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
              if (actualQuantity !== desiredTotalQuantity) {
                console.error(`Cart quantity mismatch in history: Expected ${desiredTotalQuantity}, but found ${actualQuantity} for variantId ${action.variantId}`);
                sendMessageToAChat(MessageSender.bot, {
                  message: `There was an issue loading the cart history. Expected ${desiredTotalQuantity} items, but found ${actualQuantity}. Please check your cart.`,
                  emotion: "sad",
                  customClass: "error-message"
                });
              }
              executedActions.add(actionKey);
            } catch (error) {
              console.error("Error adding item to cart from history:", error);
              sendMessageToAChat(MessageSender.bot, {
                message: "Sorry, I couldn’t add the item to your cart when loading the history.",
                emotion: "sad",
                customClass: "error-message"
              });
            }
          } else if (action.action === "removeFromCart") {
            try {
              const cartState = await getCartState();
              const currentQuantity = cartState.items.find(item => item.variant_id === Number(action.variantId))?.quantity || 0;
              const newQuantity = Number(action.quantity);
              if (currentQuantity === newQuantity) {
                console.log(`Skipping removeFromCart: Cart already has ${currentQuantity} units of variantId ${action.variantId}`);
                executedActions.add(actionKey);
                continue;
              }
              if (currentQuantity > 0) {
                await cartActions.removeFromCart({
                  variantId: action.variantId,
                  quantity: newQuantity,
                });
                console.log(`Set quantity of item with variantId ${action.variantId} to ${newQuantity} in cart from history`);
                executedActions.add(actionKey);
              } else {
                console.log(`Item with variantId ${action.variantId} not in cart, skipping remove from history`);
                executedActions.add(actionKey);
              }
            } catch (error) {
              console.error("Error removing item from cart from history:", error);
              sendMessageToAChat(MessageSender.bot, {
                message: "Sorry, I couldn’t remove the item from your cart when loading the history.",
                emotion: "sad",
                customClass: "error-message"
              });
            }
          } else if (action.action === "clearCart") {
            try {
              await cartActions.clearCart();
              console.log("Cart cleared successfully from history");
              executedActions.add(actionKey);
            } catch (error) {
              console.error("Error clearing cart from history:", error);
              sendMessageToAChat(MessageSender.bot, {
                message: "Sorry, I couldn’t clear your cart when loading the history.",
                emotion: "sad",
                customClass: "error-message"
              });
            }
          }
        } else if (message.type === "cartSummary") {
          await sendCartSummaryToChat();
        }
      }
    }
  }
  scrollChatToBottom();
}

/**
 * Starts a new chat.
 * Clears the chat view and shows the consent bubble.
 */
function startNewChat() {
  // Reset the state variables so that new message groups are created
  currentGroup = null;
  lastSender = null;

  // Clear executed actions for the current session
  const sessionId = getOwnCookie("_eva_sid");
  if (sessionId) {
    manageExecutedActions(sessionId).clear();
  }

  const footer = document.querySelector("#eva-chat-footer");
  footer.classList.add("invisible");
  // Clear chat view (if any) and then show the consent bubble.
  const chatView = document.querySelector("#chat-view");
  chatView.innerHTML = "";
  showConsentBubble();
}

/**
 * Appends a message bubble (or product glider) to the appropriate group.
 */
function appendMessageToGroup(sender, messageBubble) {
  if (!currentGroup || lastSender !== sender) {
    currentGroup = document.createElement("div");
    currentGroup.classList.add(`${sender}-message-group`);
    navigationEngine.getCurrentView().appendChild(currentGroup);
    lastSender = sender;
  }
  const previousProfilePic = currentGroup.querySelector(".profile-pic");
  if (previousProfilePic) {
    previousProfilePic.remove();
  }
  currentGroup.appendChild(messageBubble);
  scrollChatToBottom();
}

/**
 * Inserts a timeline element at the beginning of the chat view if it doesn’t already exist.
 */
function insertTimelineIfNotExists() {
  const chatView = document.querySelector("#chat-view");
  if (!chatView.querySelector(".timeline")) {
    const timeline = document.createElement("div");
    timeline.className = "timeline";
    timeline.innerText = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    chatView.insertBefore(timeline, chatView.firstChild);
  }
}

/**
 * Fades an element in.
 */
function fadeIn(element, callback) {
  element.classList.remove("invisible");
  element.classList.add("fade-in");
  element.addEventListener("animationend", function handler() {
    element.classList.remove("fade-in");
    element.removeEventListener("animationend", handler);
    if (callback) callback();
  });
}

/**
 * Fades an element out.
 */
function fadeOut(element, callback) {
  element.classList.add("fade-out");
  element.addEventListener("animationend", function handler() {
    element.classList.remove("fade-out");
    element.classList.add("invisible");
    element.removeEventListener("animationend", handler);
    if (callback) callback();
  });
}

// ------------------- New Functionality for Cancel Chat -------------------

/**
 * Opens a modal (inside #chat-view) asking the user to confirm ending the chat.
 * If "Yes" is clicked, the modal clears all content inside "#chat-view"
 * and then applies the fold chat logic.
 */
function openCancelChatModal() {
  const chatView = document.querySelector("#chat-view");

  // Create an overlay for the modal within #chat-view
  const modalOverlay = document.createElement("div");
  modalOverlay.classList.add("modal-overlay");

  // Create the modal window container
  const modalWindow = document.createElement("div");
  modalWindow.classList.add("modal-window");

  // Localized confirmation message from constantMessages
  const confirmationMessage = constantMessages.endChatConfirmation[currentLanguageKey] ||
    constantMessages.endChatConfirmation["en"];
  const messageParagraph = document.createElement("p");
  // Tag for updates
  messageParagraph.dataset.constantKey = "endChatConfirmation";
  messageParagraph.textContent = confirmationMessage;
  modalWindow.appendChild(messageParagraph);

  // Create container for the Yes and No buttons
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("modal-buttons");

  const yesButton = document.createElement("button");
  // Tag for updates
  yesButton.dataset.constantKey = "endChatYes";
  yesButton.textContent = constantMessages.endChatYes[currentLanguageKey] ||
    constantMessages.endChatYes["en"];

  const noButton = document.createElement("button");
  // Tag for updates
  noButton.dataset.constantKey = "endChatNo";
  noButton.textContent = constantMessages.endChatNo[currentLanguageKey] ||
    constantMessages.endChatNo["en"];

  buttonContainer.appendChild(yesButton);
  buttonContainer.appendChild(noButton);
  modalWindow.appendChild(buttonContainer);

  modalOverlay.appendChild(modalWindow);
  chatView.appendChild(modalOverlay);

  yesButton.addEventListener("click", () => {
    // Delete the cookie and clear the chat view
    deleteCookie("_eva_sid");
    console.log('cookie deleted successfully')
    // Apply fold chat logic: fade out the chat wrapper and show the bubble button,
    // then proactively suggest a new chat.
    modalOverlay.remove();
    initLoader();
  });

  noButton.addEventListener("click", () => {
    modalOverlay.remove();
  });
}

// ===================== Initialization Code =====================

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Fetch the user's preferred language or set "en" as fallback
  let fetchedKey = await fetchLanguage();
  currentLanguageKey =
    fetchedKey && languageMap[fetchedKey] ? fetchedKey : "en";
  currentLanguage = languageMap[currentLanguageKey];
  console.log("Current language key:", currentLanguageKey);
  console.log("Current language:", currentLanguage);

  // 2) Create bubble button wrapper
  const bubbleButtonWrapper = document.createElement("div");
  bubbleButtonWrapper.classList.add("eva-bubble-button-wrapper");

  // 3) Create the bubble button
  const bubbleButton = document.createElement("button");
  bubbleButton.classList.add("eva-bubble-button");

  // 4) Add an image to the bubble button
  const chatbotButtonLogo = document.createElement("img");
  chatbotButtonLogo.classList.add("chatbot-button-logo");
  chatbotButtonLogo.src = document
    .getElementById("chatbot-logo")
    .getAttribute("chatbot-logo");
  chatbotButtonLogo.alt = "Eva chat assistant";
  bubbleButton.appendChild(chatbotButtonLogo);

  // 5) Import and append your chat template (includes footer & dropdown)
  const chatClone = document.importNode(
    document.querySelector("#eva-assistant-chat-template").content,
    true
  );
  bubbleButtonWrapper.appendChild(chatClone);

  // 6) Finally append the bubble button to the wrapper
  bubbleButtonWrapper.appendChild(bubbleButton);
  bubbleButtonWrapper.classList.add("fade-in");
  document.body.appendChild(bubbleButtonWrapper);

  // 7) Now init your UI event listeners
  await initListeners(navigationEngine, messageFactory);
});