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

        fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
            .then(response => {
                return response.json();
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    }

}
