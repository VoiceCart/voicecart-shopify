import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

const app = createApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  host: new URLSearchParams(location.search).get("host"),
});

export async function fetchWithToken(url, options = {}) {
  const token = await getSessionToken(app);

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
