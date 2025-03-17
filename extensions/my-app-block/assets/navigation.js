function getScreenSwapper() {
  const configs = {
    currentView: "eva-chat-loader",
    currentInput: "eva-chat-footer"
  };

  function toggleWrappers(activeClass, currentView, container) {
    for (const view of container.children) {
      // Hide the current view
      if (view.id === currentView) {
        view.classList.add("invisible");
      }
      // Show the new active view with a fade-in
      if (view.id === activeClass) {
        view.classList.remove("invisible");
        view.classList.add("fade-in");
  
        // Remove the fade-in class once the animation is complete so that
        // it can be re-applied later if needed.
        view.addEventListener("animationend", function handler() {
          view.classList.remove("fade-in");
          view.removeEventListener("animationend", handler);
        });
      }
    }
  }

  function toggleView(newName) {
    if(newName === configs.currentView) {
      return false;
    }
    const container = document.querySelector('#eva-chat-main');
    toggleWrappers(newName, configs.currentView, container)
    configs.currentView = newName;
    return true;
  }

  function toggleInput(newName) {
    if(newName === configs.currentInput) {
      return false;
    }
    const container = document.querySelector('#eva-footer-container');
    toggleWrappers(newName, configs.currentInput, container)
    configs.currentInput= newName;
    return true;
  }

  return {
    goToChat: () => {
      toggleView("chat-view")
    },
    goToInitial: () => {
      toggleView("initial-view")
    },
    getCurrentView: () => document.querySelector("#" + configs.currentView),

    goToVoiceInput: () => {
      toggleInput("eva-voice-footer")
    },
    goToTextInput: () => {
      toggleInput("eva-chat-footer")
    },
    getCurrentInput: () => document.querySelector("#" + configs.currentInput),
  }
}
