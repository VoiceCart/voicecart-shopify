const cartActions = {

    removeFromCart: ({ variantId, quantity }) => {
        let updates = {
            [variantId]: Number(quantity),
        };

        fetch(window.Shopify.routes.root + 'cart/update.js', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ updates })
        })
            .then(response => {
                return response.json();
            })
            .catch((error) => {
                console.error('Error:', error);
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
