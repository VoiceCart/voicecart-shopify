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
        try {
            // Step 1: Summarize the user query to extract product details
            const summarizedProductInfo = await processUserQuery("summarize", content, shop);
            if (!summarizedProductInfo || !summarizedProductInfo.tokens || summarizedProductInfo.tokens.length === 0) {
                throw new Error("Unable to summarize product information from the query.");
            }
    
            // Extract the product type/category from the tokens for use in error messages
            const productTokens = summarizedProductInfo.tokens || [];
            const productType = productTokens.filter(token => !["best", "the", "find", "show"].includes(token.toLowerCase())).join(" ") || "product";
    
            // Step 2: Fetch products based on the summarized info
            const findSpecificProductResponse = await extractProduct(
                { query: summarizedProductInfo },
                shop
            );
    
            infoLog.log(
                "info",
                `Handler "findSpecificProduct" - extracted products: `,
                findSpecificProductResponse.data
            );
    
            // Check if products were found
            if (!findSpecificProductResponse || !findSpecificProductResponse.data || findSpecificProductResponse.data.length === 0) {
                return [{
                    type: "message",
                    value: `Sorry, I couldn’t find any ${productType} matching your request. Can you provide more details or try a different product?`,
                }];
            }
    
            // Step 3: Summarize the products using the productSummarizer prompt
            const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
            const productInfo = JSON.stringify(findSpecificProductResponse);
            const completionResult = await runChatCompletion({
                systemPrompt: finalPrompt,
                userQuery: productInfo,
                responseFormat: "json_object",
                sessionId,
                signal,
                shop,
                lang
            });
    
            // Step 4: Parse the summarization result
            const parsedAssistantResponse = JSON.parse(completionResult);
            if (!parsedAssistantResponse.actions || !parsedAssistantResponse.actions[0]?.content) {
                throw new Error("Failed to summarize product information.");
            }
    
            const finalShortDescription = parsedAssistantResponse.actions[0].content;
    
            // Step 5: Return the summarized product description and the product list
            return ([
                {
                    type: "message",
                    value: finalShortDescription,
                },
                {
                    type: "products",
                    value: findSpecificProductResponse?.data,
                }
            ]);
        } catch (error) {
            console.error("Error in findSpecificProduct handler:", error.message);
            infoLog.log("error", `Error in findSpecificProduct handler: ${error.message}`);
    
            // Attempt to extract product type from the original query as a fallback
            const queryTokens = content.toLowerCase().split(/\s+/);
            const productType = queryTokens.filter(token => !["best", "the", "find", "show", "can", "you", "recommend", "that", "have"].includes(token)).join(" ") || "product";
    
            return [{
                type: "message",
                value: `Sorry, I couldn’t process your request for a ${productType}. Please try again or ask for something else.`,
            }];
        }
    },

    recommendProduct: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'recommendProduct' intent");
        try {
            // Step 1: Summarize the user query to extract product details
            const summarizedProductInfo = await processUserQuery("summarize", content, shop);
            if (!summarizedProductInfo || !summarizedProductInfo.tokens || summarizedProductInfo.tokens.length === 0) {
                throw new Error("Unable to summarize product information from the query.");
            }
    
            // Extract the product type/category from the tokens
            const productTokens = summarizedProductInfo.tokens || [];
            const productType = productTokens.filter(token => !["best", "the", "recommend", "what", "whats"].includes(token.toLowerCase())).join(" ") || "product";
    
            // Step 2: Fetch products based on the summarized info
            const productResponse = await extractProduct(
                { query: summarizedProductInfo },
                shop
            );
    
            infoLog.log(
                "info",
                `Handler "recommendProduct" - extracted products: `,
                productResponse.data
            );
    
            // Check if products were found
            if (!productResponse || !productResponse.data || productResponse.data.length === 0) {
                return [{
                    type: "message",
                    value: `I couldn’t find any ${productType} to recommend right now. Can you provide more details or try a different product?`,
                }];
            }
    
            // Step 3: Summarize the products using the productSummarizer prompt
            const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.productSummarizer, lang);
            const productInfo = JSON.stringify(productResponse);
            const completionResult = await runChatCompletion({
                systemPrompt: finalPrompt,
                userQuery: productInfo,
                responseFormat: "json_object",
                sessionId,
                signal,
                shop,
                lang,
                model: "gpt-4o"
            });
    
            // Step 4: Parse the summarization result
            const parsedAssistantResponse = JSON.parse(completionResult);
            if (!parsedAssistantResponse.actions || !parsedAssistantResponse.actions[0]?.content) {
                throw new Error("Failed to summarize product information.");
            }
    
            const finalShortDescription = parsedAssistantResponse.actions[0].content;
    
            // Step 5: Return the summarized product description and the product list
            return ([
                {
                    type: "message",
                    value: `Here are some of the best ${productType} I can recommend:\n${finalShortDescription}`,
                },
                {
                    type: "products",
                    value: productResponse?.data,
                }
            ]);
        } catch (error) {
            console.error("Error in recommendProduct handler:", error.message);
            infoLog.log("error", `Error in recommendProduct handler: ${error.message}`);
    
            // Fallback: Extract product type from the original query
            const queryTokens = content.toLowerCase().split(/\s+/);
            const productType = queryTokens.filter(token => !["best", "the", "recommend", "what", "whats", "can", "you"].includes(token)).join(" ") || "product";
    
            return [{
                type: "message",
                value: `Sorry, I couldn’t process your request to recommend a ${productType}. Please try again or ask for something else.`,
            }];
        }
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
        
        const { variantId, quantity, explanation } = parsedAssistantResponse;
        
        if (!variantId || !quantity) {
            infoLog.log("error", "Missing variantId or quantity in addToCart response");
            return [{
                type: "message",
                value: "Sorry, I couldn’t add the item to your cart. Please try again.",
            }];
        }
    
        const message = explanation || `Updating cart to have a total of ${quantity} units.`;
        const response = [
            {
                type: "message",
                value: message,
            },
            {
                type: "action",
                value: {
                    action: "addToCart",
                    variantId,
                    quantity, // Total desired quantity
                },
            }
        ];
        console.log("addToCart handler response:", JSON.stringify(response));
        return response;
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
        
        // Extract variantId, quantity, and explanation from the response
        const { variantId, quantity, explanation } = parsedAssistantResponse;
        
        if (!variantId) {
            infoLog.log("error", "Missing variantId in removeFromCart response");
            return [{
                type: "message",
                value: "Sorry, I couldn’t remove the item from your cart. Please try again.",
            }];
        }
    
        // Return the confirmation message and an action for the client to handle
        const message = explanation || "Item removed from cart.";
        return [
            {
                type: "message",
                value: message,
            },
            {
                type: "action",
                value: {
                    action: "removeFromCart",
                    variantId,
                    quantity,
                },
            }
        ];
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
    
        // Check for cartSummary intent first
        if (content.toLowerCase().includes("what's in my cart") || content.toLowerCase().includes("show my cart") || content.toLowerCase().includes("show my card")) {
            return [{
                type: "cartSummary",
                value: "Show cart contents"
            }];
        }
    
        // If not cartSummary, process the identified intent
        const cartRelatedChildResponse = await processUserQuery(
            parsedAssistantResponse.intent,
            parsedAssistantResponse.content,
            shop,
            sessionId,
            signal,
            lang
        );
    
        return cartRelatedChildResponse;
    },

    checkoutCart: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'checkoutCart' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.checkoutCart, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

        const { discountCode, explanation } = parsedAssistantResponse;

        const message = explanation || "Proceeding to checkout.";
        return [
            {
                type: "message",
                value: message,
            },
            {
                type: "action",
                value: {
                    action: "checkoutCart",
                    discountCode: discountCode || null
                },
            }
        ];
    },

    applyDiscount: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'applyDiscount' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.applyDiscount, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

        const { discountCode, explanation } = parsedAssistantResponse;

        if (!discountCode) {
            return [{
                type: "message",
                value: "Please provide a discount code to apply.",
            }];
        }

        const message = explanation || `Applying discount code "${discountCode}".`;
        return [
            {
                type: "message",
                value: message,
            },
            {
                type: "action",
                value: {
                    action: "applyDiscount",
                    discountCode
                },
            }
        ];
    },

    clearCart: async (content, { sessionId, signal, shop, lang }) => {
        infoLog.log("info", "Showing results for the 'clearCart' intent");
        const finalPrompt = addLanguageConstraint(SYSTEM_PROMPT.clearCart, lang);
        const completionResult = await runChatCompletion({
            systemPrompt: finalPrompt,
            userQuery: content,
            responseFormat: "json_object",
            sessionId,
            signal,
            shop,
            lang,
            model: "gpt-4o"
        });
        const parsedAssistantResponse = JSON.parse(completionResult).actions[0].content;

        const message = parsedAssistantResponse.explanation || "All items will be removed from your cart.";
        return [
            {
                type: "message",
                value: message,
            },
            {
                type: "action",
                value: {
                    action: "clearCart"
                },
            }
        ];
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
