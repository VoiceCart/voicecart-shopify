import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  return json({ 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopOrigin: session.shop
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