// app-window.js


document.addEventListener("DOMContentLoaded", () => {
  const getCookie = name => document.cookie
    .split("; ")
    .map(entry => entry.split("="))
    .find(entry => entry[0] === name)[1] || "";

  // Элементы для пользовательского ввода
  const sendQueryButton = document.getElementById("send-query-button");
  const queryInput = document.getElementById("query-input");
  const recordVoiceButton = document.getElementById("record-voice-button");
  const initialView = document.getElementById("initial-view");
  const chatView = document.getElementById("chat-view");
  const messagesContainer = document.getElementById("messages-container");
  const optionButtons = document.querySelectorAll(".option-button");

  // Проверка наличия элементов
  if (!sendQueryButton || !queryInput || !recordVoiceButton || !initialView || !chatView) {
    console.error("One or more required elements are not found in the DOM.");
    return;
  }

  // Инициализация состояния
  let isRecording = false;
  let messages = [];

  // Обработка кликов по кнопкам опций
  optionButtons.forEach(button => {
    button.addEventListener("click", () => {
      const query = button.textContent.trim();
      handleUserMessage(query);
    });
  });

  // Обработка отправки сообщений
  function handleUserMessage(message) {
    if (!message.trim()) return;

    // Скрываем начальный экран и показываем чат
    if (initialView.style.display !== "none") {
      initialView.classList.add("fade-out");
      setTimeout(() => {
        initialView.style.display = "none";
        chatView.style.display = "block";
        chatView.classList.add("fade-in");
      }, 300);
    }

    // Добавляем сообщение пользователя в чат
    addMessage(message, "user");

    // Отправляем сообщение ассистенту
    sendQueryToAssistant(message);
  }

  // Добавление сообщения в чат
  function addMessage(content, role) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role} message-appear`;

    const textDiv = document.createElement("div");
    textDiv.className = `message-content ${role}-message`;
    textDiv.textContent = content;

    messageDiv.appendChild(textDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    messages.push({ content, role });
  }

  // Обработка клика по кнопке отправки
  sendQueryButton.addEventListener("click", () => {
    const userInput = queryInput.value.trim();
    if (userInput) {
      handleUserMessage(userInput);
      queryInput.value = "";
    }
  });

  // Обработка нажатия клавиши Enter
  queryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const userInput = queryInput.value.trim();
      if (userInput) {
        handleUserMessage(userInput);
        queryInput.value = "";
      }
    }
  });

  // Логика Web Speech API для голосового ввода
  recordVoiceButton.addEventListener("click", () => {
    // The check for Speech Recognition support and microphone permission is now handled in app_v1.js
    // This listener will only handle the recording state, as the modal for unsupported browsers is shown in app_v1.js
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Do nothing here; app_v1.js will handle showing the modal
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    if (isRecording) {
      recognition.stop();
      isRecording = false;
      recordVoiceButton.classList.remove("recording");
    } else {
      recognition.start();
      isRecording = true;
      recordVoiceButton.classList.add("recording");

      recognition.onstart = () => {
        console.log("Recording started... Speak!");
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        queryInput.value = transcript;

        if (event.results[event.results.length - 1].isFinal) {
          console.log("Final recognized text: ", transcript);
          handleUserMessage(transcript);
          isRecording = false;
          recordVoiceButton.classList.remove("recording");
        }
      };

      recognition.onerror = (event) => {
        console.error("Error during recording: ", event.error);
        isRecording = false;
        recordVoiceButton.classList.remove("recording");
      };

      recognition.onend = () => {
        console.log("Recording stopped automatically.");
        isRecording = false;
        recordVoiceButton.classList.remove("recording");
      };
    }
  });

  // Функция для отправки запроса на /api/assistant и отображения результата
  function sendQueryToAssistant(query) {
    console.log("Session id: ", getCookie("_shopify_s"));
    const url = `/apps/api/assistant?query=${encodeURIComponent(query)}&session=${getCookie("_shopify_s")}`;

    // Логируем отправляемый запрос
    console.log("Sending request to server:", { url, method: "GET" });

    fetch(url, {
      method: "GET",
      credentials: 'include'
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Response from server:", data);

        if (data.variantId) {
          // Если есть variantId, добавляем товар в корзину
          addToCart(data.variantId);
        }

        // Добавляем сообщение ассистента в чат
        if (data.message) {
          addMessage(data.message, "assistant");
        } else if (data.response) {
          addMessage(data.response, "assistant");
        }
      })
      .catch((error) => {
        console.error("Error during request:", error);
        alert("An error occurred while communicating with the assistant.");
      });
  }

  // Функция для добавления товара в корзину
  function addToCart(productData) {
    fetch(window.Shopify.routes.root + 'cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    })
    .then(response => {
      return response.json();
    })
    .catch((error) => {
      console.error('Error:', error);
    });
  }
});
