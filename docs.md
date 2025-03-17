## Find product payload structure
```
//Extractor payload
FE Query: "Hi, do you have black nike cortez shoes?"

//Extractor response --> Query embedding payload
{
  "actions": [
    {
      "intent": "findProduct",
      "content": {
        "query": "black nike cortez"
      }
    }
  ]
}

//Query embedding response
{
  "actions": [
    {
      "intent": "findProduct",
      "content": {
        "query": "black nike cortez",
        "products": [
          {
            "handle": "product_handle",
            "variantId": "mock_data",
            "price":"25",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-pants",
            "variantId": "mock_data",
            "price":"22",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-t-shirt",
            "variantId": "mock_data",
            "price":"21",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-t-shirt2",
            "variantId": "mock_data",
            "price":"18",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handleat",
            "variantId": "mock_data",
            "price":"12",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          }
        ]
      }
    }
  ]
}
```

## Add to cart/remove from cart payload structure
```
//Extractor payload
FE Query: "Please add everything to the cart"

//Extractor response
{
  "actions": [
    {
      "intent": "addToCart", //or removeFromCart
      "content": {
        "query": "please add the everything to the cart"
      }
    }
  ]
}

//Context keeper payload
{
  "actions": [
    {
      "intent": "specifyDetails",
      "content": {
        "query": "please add the cheapest one to the cart",
        "products": [
          {
            "handle": "product_handle",
            "variantId": "mock_data",
            "price":"25",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-pants",
            "variantId": "mock_data",
            "price":"22",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-t-shirt",
            "variantId": "mock_data",
            "price":"21",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handle-t-shirt2",
            "variantId": "mock_data",
            "price":"18",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          },
          {
            "handle": "product_handleat",
            "variantId": "mock_data",
            "price":"12",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          }
        ]
      }
    }
  ]
}

//Context keeper response
{
  "actions": [
    {
      "intent": "specifyDetails",
      "content": {
        "query": "please add the cheapest one to the cart",
        "products": [
          {
            "handle": "product_handleat",
            "variantId": "mock_data",
            "price":"12",
            "category":"Shoes",
            "description":"",
            "brand":"Nike",
            "name": "Nike Cortez shoes"
          }
        ]
      }
    }
  ]
}
```