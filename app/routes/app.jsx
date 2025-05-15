import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  let apiKey = process.env.SHOPIFY_API_KEY;
  let shop = "";

  try {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
  } catch (error) {
    console.warn("No valid session in /app loader (first load or unauthorized):", error);
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

      <script dangerouslySetInnerHTML={{
        __html: `
          window.shopify = {
            config: {
              apiKey: "${apiKey}",
              shopOrigin: "${shopOrigin || ''}",
              appPath: "/api"
            }
          };
        `
      }} />
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
