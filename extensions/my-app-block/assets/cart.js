const cartActions = {
  removeFromCart: ({ variantId, quantity }) => {
      let formData = {
        'id': variantId,
        'quantity': Number(quantity) // Use the provided quantity instead of hardcoding to 0
      };
      return fetch(window.Shopify.routes.root + 'cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
        .then(response => response.json())
        .catch(error => {
          console.error('Error:', error);
          throw error;
        });
  },

  addToCart: ({ variantId, quantity }) => {
      let formData = {
          'items': [{
              'id': variantId,
              'quantity': Number(quantity)
          }]
      };

      return fetch(window.Shopify.routes.root + 'cart/add.js', {  // Return the promise chain
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
      })
          .then(response => response.json())
          .catch((error) => {
              console.error('Error:', error);
              throw error;
          });
  },

  clearCart: () => {  // New action to clear the cart
      return fetch(window.Shopify.routes.root + 'cart/clear.js', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          }
      })
          .then(response => response.json())
          .catch(error => {
              console.error('Error clearing cart:', error);
              throw error;
          });
  }
}
