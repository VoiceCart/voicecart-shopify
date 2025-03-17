import axios from "axios";
import {infoLog} from "../logger.server.js";

// const prodUrl = process.env.ML_SERVER_URL;
// const testUrl = "http://localhost:5556"
const prodUrlText = "http://ml-api:5556"
const navigationEngine = {
  queryEmbeddingsUrl: () => prodUrlText + "/query_embedding",
}

const getCommonHeaders = (shop) => ({
  headers: {
    // 'Content-Type': 'application/octet-stream', // Indicate binary content
    // 'Content-Disposition': `attachment; filename="${shop}.parquet"`,
    'Content-Type': 'application/json', // Ensure the request body is treated as JSON
    'X-Shop-Name': shop,
  },
  timeout: 3600000, // 1-hour timeout
})

export async function extractProduct(query, shop) {
  try{
    const queryResponse = await axios.post(
      navigationEngine.queryEmbeddingsUrl(),
      query,
      getCommonHeaders(shop)
    );
    //infoLog.log("info", `Function "extractProduct" - `, queryResponse.data)

    return {
      data: queryResponse.data
    };
  } catch (e) {
    console.log(e)
  }
}
