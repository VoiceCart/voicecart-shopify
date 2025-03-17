import axios from 'axios';
import { authenticate } from "../shopify.server";
import { updateTaskStatus } from '../db.server';

export async function deleteEmbeddingsTask(taskId, request) {
  try {
    // Authenticate and get the shop name
    const { admin } = await authenticate.admin(request);
    const shopDomain = admin.rest.session.shop;
    const shopName = shopDomain.split('.')[0];
    console.log("Deleting embeddings for:", shopName);

    // Send DELETE request to the embedding service
    const deleteResponse = await axios.delete(
      'http://ml-api:5556/delete_embeddings',
      //`${process.env.ML_SERVER_URL}/create_embeddings`,
      {
        headers: {
          'X-Shop-Name': shopName
        },
        timeout: 60000 // Optional timeout (1 minute)
      }
    );

    console.log('Delete embeddings response:', deleteResponse.data);

    // Update task status to success with the response from the embedding service
    await updateTaskStatus(taskId, 'success', {
      deleteResponse: deleteResponse.data
    });
    console.log('Embeddings deleted successfully');
  } catch (error) {
    console.error('Error deleting embeddings:', error);

    // Update task status to failed with error details
    await updateTaskStatus(taskId, 'failed', {
      errorMessage: error.message,
      errorDetails: error.toString(),
    });
  }
}
