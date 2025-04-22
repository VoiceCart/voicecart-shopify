import { authenticate } from "../shopify.server";
import { insertAppBlock } from "../utils/insertAppBlock.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await insertAppBlock(session);
  return null;
};
