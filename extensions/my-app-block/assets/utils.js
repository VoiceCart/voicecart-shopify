const getCookie = name => document.cookie
  .split("; ")
  .map(entry => entry.split("="))
  .find(entry => entry[0] === name)[1] || "";


/**
 * Generates a UUID.
 */
function generateUUID() {
  // Source: https://stackoverflow.com/a/2117523/951754
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

/**
 * Sets a cookie with given name, value, and days to expire.
 */
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days*24*60*60*1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax; Secure";
}

/**
 * Gets a cookie by name.
 */
function getOwnCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i=0;i < ca.length;i++) {
      let c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

function scrollChatToBottom() {
  const container = document.querySelector("#chat-view");
  container.scrollTop = container.scrollHeight;
}

function setLanguage(langKey) {
  currentLanguageKey = langKey;
  currentLanguage = languageMap[langKey] || 'en-US';
  console.log('Language has been switched to:', currentLanguage);
  // If you need to re-start voice chat or TTS to apply new language:
  // voiceChat.stop();
  // voiceChat.start();
}

// A helper (stub) to fetch the language from your cookie or storage
async function fetchLanguage() {
  const storedLang = getOwnCookie("_eva_language");
  return storedLang || null;
}


/**
 * Deletes a cookie by name.
 * @param {string} name - The cookie name.
 */
function deleteCookie(name) {
  document.cookie =
    name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

/**
 * Returns the correct URL for API requests based on the context
 * @param {string} path - API path (e.g. '/tts')
 * @returns {string} - Full URL for fetch requests
 */
function getApiUrl(path) {
  // При работе в Shopify магазине
  if (window.location.host.includes('.myshopify.com')) {
    // маршрут прокси из shopify.app.toml: prefix = "apps", subpath = "api"
    const proxyBase = '/apps/api';

    // Если вы явно переопределяли appPath (обычно "/api"), 
    // заменим его на прокси-путь
    if (window.shopify && window.shopify.config) {
      // если пользователь держал appPath="/api", то возьмём "/apps/api"
      const basePath = window.shopify.config.appPath === '/api'
        ? proxyBase
        : window.shopify.config.appPath;
      return `${basePath}${path.startsWith('/') ? path : '/' + path}`;
    }

    // если нет window.shopify.config — просто берём прокси
    return `${proxyBase}${path.startsWith('/') ? path : '/' + path}`;
  }

  // Для локальной разработки — оставляем как есть
  return path;
}
