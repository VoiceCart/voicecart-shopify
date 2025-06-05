/**
 * For demonstration, always returns false. Adjust as needed for real session.
 */
async function fetchSessionState() {
  try {
    let evaCookieSid = getOwnCookie("_eva_sid")
    if (evaCookieSid == null) {
      return false;
    }
    else {
      const url = `/apps/api/assistant?action=getSessionHistory&session=${evaCookieSid}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shop-Name": getShopName(),
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "ShopifyAppProxy/1.0",
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch session state: ${response.status}`);
        return false;
      }

      const data = await response.json();
      if (data.error) {
        console.error(`Server error: ${data.error}`);
        return false;
      }
      return data || [];
    }
  } catch (error) {
    console.error("Error fetching session state:", error);
    return false;
  }
}


async function fetchLanguage() {
  try {
    let evaCookieSid = getOwnCookie("_eva_sid")
    if (evaCookieSid == null) {
      return false;
    }
    // Try to get the language cookie value.
    let evaLanguageCookie = getOwnCookie("_eva_language");
    if (evaLanguageCookie != null) {
      return evaLanguageCookie; // Return the cookie value if it exists.
    } else {
      const url = `/apps/api/assistant?action=getLanguage&session=${evaCookieSid}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shop-Name": getShopName(),
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "ShopifyAppProxy/1.0",
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch language: ${response.status}`);
        return "";
      }

      const data = await response.json();
      if (data.error) {
        console.error(`Server error: ${data.error}`);
        return "";
      }

      // Expecting data to have the shape { language: "en" } (for example)
      return data.language || "";
    }
  } catch (error) {
    console.error("Error fetching language:", error);
    return "";
  }
}

/**
 * Retrieves the shop name from the Shopify storefront configuration.
 */
function getShopName() {
  // Use the store name from window.Shopify.shop
  if (window.Shopify?.shop) {
    return window.Shopify.shop;
  }
  // Fallback to URL host if shop is not available
  const shopNameUrl = new URL(document.URL);
  return shopNameUrl.host;
}

/**
 * Calls the /apps/api/assistant?query=... endpoint with GET
 * If `signal` is provided (from AbortController), pass it to fetch so we can abort.
 */
async function fetchMessage(text, signal) {
  const url = `/apps/api/assistant?query=${encodeURIComponent(text)}&action=getAssistantResponse&session=${getOwnCookie("_eva_sid")}&lang=${encodeURIComponent(currentLanguage)}`;
  const shopNameUrl = new URL(document.URL);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shop-Name": shopNameUrl.host,
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "ShopifyAppProxy/1.0",
      },
      signal
    });

    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }

    const data = await response.json();
    console.log("fetchMessage response data: ", data);
    return { messages: data.messages || [] };
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("fetchMessage was aborted by user.");
      return { messages: [] }; // Return empty to avoid break
    }
    throw err;
  }
}

/**
 * Deletes the last message for the current session from the DB by calling
 * the DELETE method on /apps/api/assistant?session=...
 */
async function deleteLastMessage(lastMessage) {
  const url = `/apps/api/assistant?session=${getOwnCookie("_eva_sid")}&query=${encodeURIComponent(lastMessage)}`;
  const shopNameUrl = new URL(document.URL);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Shop-Name": shopNameUrl.host,
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "ShopifyAppProxy/1.0",
      }
    });

    const data = await response.json();
    console.log("deleteLastMessage response:", data);
    return data;
  } catch (err) {
    console.error("deleteLastMessage error:", err);
    return { error: err };
  }
}

/**
 * Minimal cookie getter example; adjust if needed
 */
function getOwnCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) {
    return match[2];
  }
  return "";
}
