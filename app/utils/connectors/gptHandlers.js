import { runChatCompletion } from "./gptConnector.js";
import { SYSTEM_PROMPT, localeNameMap, addLanguageConstraint } from "./gptIntents.js";
import { extractProduct } from "./embedingConnector.js";
import { infoLog } from "../logger.server.js";


export async function getChatResponse({ userQuery, shop, sessionId, signal, lang }) {
    // 1. Extract
    const extractorResult = await processUserQuery("extract", userQuery, shop, sessionId, signal, lang);
    const parsedCompletionResult = JSON.parse(extractorResult.value);

    const producedMessages = [];
    infoLog.log("info", `Sending query for the session ${sessionId}`);
    // 2. Loop through each action
    for (const action of parsedCompletionResult.actions) {
        const assistantResponse = await processUserQuery(
            action.intent,
            userQuery, // or action.content if you want to pass the content from the extraction
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
    extract: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'extract' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.extractor, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });

        return {
            type: "message",
            value: `${completionResult}`,
        };
    },

    productRelated: async (content, { sessionId, shop, signal, lang }) => {
        infoLog.log("info", "Showing results for the 'productRelated' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productRelated, lang);
        const completionResultProductRelated = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            sessionId,
            shop,
            responseFormat: "json_object",
            signal,
            lang
        });
        const relatedProductResponseObject = JSON.parse(completionResultProductRelated)["actions"][0];

        const productRelatedChildResponse = await processUserQuery(
            relatedProductResponseObject.intent,
            relatedProductResponseObject.content,
            shop,
            sessionId,
            signal,
            shop,
            lang
        );

        console.log(productRelatedChildResponse);

        return productRelatedChildResponse;
    },

    greet: async (content, { sessionId, signal, lang, shop }) => {
        infoLog.log("info", "Showing results for the 'greet' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.greet, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    whoAreYou: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'whoAreYou' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.whoAreYou, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    specifyProduct: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'specifyProduct' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productSpecifier, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    productSummarizer: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'productSummarizer' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    findSpecificProduct: async (content, { sessionId, signal, lang, shop }) => {
        infoLog.log("info", "Showing results for the 'findSpecificProduct' intent");
        const summarizedProductInfo = await processUserQuery("summarize", content, shop); //#TODO: speed to be improved 
        const findSpecificProductResponse = await extractProduct(
            { query: summarizedProductInfo },//content,
            shop
        );

        infoLog.log(
            "info",
            `Handler "findSpecificProduct" - extracted products: `,
            findSpecificProductResponse.data
        );
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
        // Build the summarizer input. For instance, pass name, price, and a short description:
        const productInfo = JSON.stringify(findSpecificProductResponse);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: productInfo,      // Summaries for all products
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        console.log('product summary: completion result: ', completionResult)
        // 3) Let's assume the returned JSON from your summarizer has an "actions" array with "content"
        //    that might contain a short summary text. Parse as needed:
        const parsedAssistantResponse = JSON.parse(completionResult);
        console.log('product summary: parsedAssistantResponse: ', parsedAssistantResponse)
        // For instance, if it lumps everything into a single string:
        const finalShortDescription = parsedAssistantResponse.actions[0].content;

        console.log('product summary: finalShortDescription: ', finalShortDescription)
        return ([{
            type: "message",
            value: finalShortDescription,
        }
            ,
        {
            type: "products",
            value: findSpecificProductResponse?.data,
        }]
        );
    },

    recommendProduct: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'recommendProduct' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productRecommender, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            lang,
            shop,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    compareProducts: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'recommendProduct' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.compareProducts, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    explainProduct: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'explainProduct' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productExplainer, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },


    addToCart: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'addToCart' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.addToCart, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            lang,
            shop,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },


    removeFromCart: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'removeFromCart' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.removeFromCart, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            lang,
            shop,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    },

    cartRelated: async (content, { sessionId, shop, signal, lang }) => {
        infoLog.log("info", "Showing results for the 'cartRelated' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.cartRelated, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            sessionId,
            responseFormat: "json_object",
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult)["actions"][0];

        const cartRelatedChildResponse = await processUserQuery(
            parsedAssistantResponse.intent,
            parsedAssistantResponse.content
        );

        console.log(cartRelatedChildResponse);

        return cartRelatedChildResponse;
    },


    summarize: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'summarize' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.summarizer, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return parsedAssistantResponse;
    },

    undefined: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'undefined' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.undefined, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;
        return [{
            type: "message",
            value: `${parsedAssistantResponse}`,
        }];
    }
};


export async function processUserQuery(intent, content, shop, sessionId, signal, lang) {
    const handler = intentMapping[intent];
    if (handler) {
        const response = await handler(content, { shop, sessionId, signal, lang });
        return response;
    }
    throw new Error(`No handler found for an intent ${intent} | ${content}`);
}
