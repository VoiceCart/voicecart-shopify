import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const authHeader = request.headers.get("Authorization");
  let apiKey = process.env.SHOPIFY_API_KEY;
  let shop = "";

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = await api.session.decodeSessionToken(token);
      shop = payload.shop;
    } catch (error) {
      console.error("JWT decode failed in /app loader:", error);
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    // fallback — iframe заход без токена (первый запуск)
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    } catch (error) {
      console.warn("No session in iframe init (probably first load)");
      // не падаем! просто отдаем минимальные данные
    }
  }

  return json({
    apiKey,
    shopOrigin: shop || "",
  });
};

export default function App() {
  const { apiKey, shopOrigin } = useLoaderData();

  return (
    <>
      <AppProvider isEmbeddedApp apiKey={apiKey}>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
        </NavMenu>
        <Outlet />
      </AppProvider>
      
      {/* Добавляем глобальную конфигурацию для клиентских скриптов */}
      <script dangerouslySetInnerHTML={{ __html: `
        window.shopify = {
          config: {
            apiKey: "${apiKey}",
            shopOrigin: "${shopOrigin || ''}",
            appPath: "/api" // Путь для API вызовов
          }
        };
      `}} />
    </>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};