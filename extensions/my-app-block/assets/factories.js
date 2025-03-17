// Make sure you've loaded or imported Marked (e.g. via <script src="marked.min.js"></script>)
// or imported { marked } from 'marked' if you're using a bundler.

function getMessageFactory() {
  return {
    createCustomerMessage: (text) => {
      // Create a wrapper that represents the customer's chat bubble
      const chatWrapper = document.createElement("div");
      chatWrapper.classList.add("chat-customer-message", "chat-message-background-wrapper");

      // Use a <div> instead of <p>, and add "markdown-content" for styling
      const messageContent = document.createElement("div");
      messageContent.classList.add("chat-customer-message-content");
      // Convert markdown to HTML
      messageContent.innerHTML = marked.parse(text);

      // Assemble the customer message
      chatWrapper.appendChild(messageContent);
      return chatWrapper;
    },

    createBotMessage: (text, emotion, options = {}) => {
      // Outer wrapper holds the profile picture + the message bubble
      const wrapperDiv = document.createElement("div");
      wrapperDiv.classList.add("chat-bot-message-with-pic-wrapper");

      // Create and configure the bot's profile image
      const profileImg = document.createElement("img");
      profileImg.classList.add("profile-pic");

      // Map the emotion to the relevant attribute name
      const emotionMapping = {
        welcoming: "eva-welcoming",
        sad: "eva-sad",
        thinking: "eva-thinking",
        sleeping: "eva-sleeping"
      };
      const emotionKey = emotionMapping[emotion] || "eva-welcoming";

      // Retrieve the correct image URL from your hidden image element
      profileImg.src = document
        .getElementById("eva-chat-pics")
        .getAttribute(emotionKey);
      profileImg.alt = "Bot profile icon";

      // Create the main message bubble container
      const messageDiv = document.createElement("div");
      messageDiv.classList.add(
        "chat-bot-message",
        "chat-message-background-wrapper",
        "chat-message-background-transparent"
      );
      if (options.customClass) {
        messageDiv.classList.add(options.customClass);
      }

      // Use a <div> for the bot's message content, with markdown styling
      const messageContent = document.createElement("div");
      messageContent.classList.add("chat-bot-message-content", "markdown-content");
      messageContent.innerHTML = marked.parse(text);

      // Assemble the bot message
      messageDiv.appendChild(messageContent);
      wrapperDiv.appendChild(profileImg);
      wrapperDiv.appendChild(messageDiv);

      return wrapperDiv;
    },

    createProductMessage: (productList) => {
      // Remains unchanged; presumably calls your existing generateGlideMarkup function
      return generateGlideMarkup(productList);
    }
  };
}
