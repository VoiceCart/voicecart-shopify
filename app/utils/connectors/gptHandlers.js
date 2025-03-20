import { runChatCompletion, getCombinedPrompt } from "./gptConnector.js";
import { SYSTEM_PROMPT, addLanguageConstraint } from "./gptIntents.js";
import { extractProduct } from "./embedingConnector.js";
import { infoLog } from "../logger.server.js";

export async function getChatResponse({ userQuery, shop, sessionId, signal, lang }) {
  // 1. Extract
  const extractorResult = await processUserQuery("extract", userQuery, shop, sessionId, signal, lang);
  // Because the extract handler returns an array, take the first message and parse its value
  const parsedCompletionResult = JSON.parse(extractorResult[0].value);

  const producedMessages = [];
  infoLog.log("info", `Sending query for the session ${sessionId}`);

  // 2. Loop through each action
  for (const action of parsedCompletionResult.actions) {
    const assistantResponse = await processUserQuery(
      action.intent,
      userQuery,
      shop,
      sessionId,
      signal,
      lang
    );
    for (const message of assistantResponse) {
      producedMessages.push(message);
    }
  }

  // 3. Return final array of messages
  return producedMessages;
}

const intentMapping = {
  // ------------------------------------------------------------------
  // EXTRACT: special case => must return JSON alone, no debug text
  // ------------------------------------------------------------------
  extract: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'extract' intent");

    // 1. Build base prompt and add language constraint
    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.extractor, lang);

    // 2. Combine with shop context using shop parameter
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    // Optional: log to server console
    infoLog.log("info", `[DEBUG - EXTRACT] Final prompt for session ${sessionId}:\n${combinedPrompt}`);

    // 3. Call runChatCompletion with the final prompt
    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });

    // 4. Validate and parse the result
    let parsedResult;
    try {
      parsedResult = JSON.parse(completionResult);
      if (!parsedResult.actions || !Array.isArray(parsedResult.actions)) {
        throw new Error("Invalid JSON structure: 'actions' array missing");
      }
    } catch (error) {
      infoLog.log("error", `Extraction failed for session ${sessionId}: ${error.message}`);
      // Return a fallback JSON response
      parsedResult = {
        actions: [{ intent: "undefined", content }]
      };
    }

    // Return as an array with a single message containing the JSON string
    return [{
      type: "message",
      value: JSON.stringify(parsedResult), // Ensure it's a stringified JSON
    }];
  },

  // ------------------------------------------------------------------
  // For all other intents, we can show a debug message in the chat
  // ------------------------------------------------------------------
  productRelated: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'productRelated' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productRelated, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      sessionId,
      responseFormat: "json_object",
      signal,
      lang,
    });

    const relatedProductResponseObject = JSON.parse(completionResult).actions[0];

    const productRelatedChildResponse = await processUserQuery(
      relatedProductResponseObject.intent,
      relatedProductResponseObject.content,
      shop,
      sessionId,
      signal,
      lang
    );

    return [debugMessage, ...productRelatedChildResponse];
  },

  greet: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'greet' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.greet, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  whoAreYou: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'whoAreYou' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.whoAreYou, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  specifyProduct: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'specifyProduct' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productSpecifier, lang);
    const extraInstruction = "If the store does not carry the specified product, say so clearly rather than asking for more details.";
    const basePromptWithFix = `${basePrompt}\n${extraInstruction}`;

    const combinedPrompt = await getCombinedPrompt(basePromptWithFix, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  productSummarizer: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'productSummarizer' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  findSpecificProduct: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'findSpecificProduct' intent");

    // Summarize user query first
    const summarizedProductInfo = await processUserQuery("summarize", content, shop, sessionId, signal, lang);
    const findSpecificProductResponse = await extractProduct(
      { query: summarizedProductInfo },
      shop
    );

    infoLog.log(
      "info",
      `Handler "findSpecificProduct" - extracted products: `,
      findSpecificProductResponse.data
    );

    // Build final prompt
    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const productInfo = JSON.stringify(findSpecificProductResponse);
    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: productInfo,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult);
    const finalShortDescription = parsedAssistantResponse.actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: finalShortDescription,
      },
      {
        type: "products",
        value: findSpecificProductResponse?.data,
      },
    ];
  },

  recommendProduct: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'recommendProduct' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productRecommender, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
      model: "gpt-4o",
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  compareProducts: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'compareProducts' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.compareProducts, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  explainProduct: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'explainProduct' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.productExplainer, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  addToCart: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'addToCart' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.addToCart, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
      model: "gpt-4o",
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  removeFromCart: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'removeFromCart' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.removeFromCart, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
      model: "gpt-4o",
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  cartRelated: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'cartRelated' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.cartRelated, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      sessionId,
      responseFormat: "json_object",
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult)["actions"][0];

    const cartRelatedChildResponse = await processUserQuery(
      parsedAssistantResponse.intent,
      parsedAssistantResponse.content,
      shop,
      sessionId,
      signal,
      lang
    );

    return [debugMessage, ...cartRelatedChildResponse];
  },

  summarize: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'summarize' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.summarizer, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },

  undefined: async (content, { sessionId, shop, signal, lang }) => {
    infoLog.log("info", "Showing results for the 'undefined' intent");

    const basePrompt = addLanguageConstraint(SYSTEM_PROMPT.undefined, lang);
    const combinedPrompt = await getCombinedPrompt(basePrompt, shop);

    const debugMessage = {
      type: "message",
      value: `DEBUG PROMPT:\n${combinedPrompt}`,
    };

    const completionResult = await runChatCompletion({
      systemPrompt: combinedPrompt,
      userQuery: content,
      responseFormat: "json_object",
      sessionId,
      signal,
      lang,
    });
    const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

    return [
      debugMessage,
      {
        type: "message",
        value: parsedAssistantResponse,
      },
    ];
  },
};

export async function processUserQuery(intent, content, shop, sessionId, signal, lang) {
  const handler = intentMapping[intent];
  if (handler) {
    const response = await handler(content, { shop, sessionId, signal, lang });
    // Return array or single object
    return Array.isArray(response) ? response : [response];
  }
  throw new Error(`No handler found for an intent ${intent} | ${content}`);
}