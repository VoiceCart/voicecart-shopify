async function generateGlideMarkup(products, prefix) {
  const glideContainer = document.createElement('div');
  glideContainer.classList.add("glide", 'glide-' + prefix, 'text-glide');

  const glideTrack = document.createElement('div');
  glideTrack.classList.add('glide__track');
  glideTrack.setAttribute('data-glide-el', 'track');

  const glideSlides = document.createElement('ul');
  glideSlides.classList.add('glide__slides', 'full-width');

  function formatPrice(priceInCents) {
    if (typeof priceInCents !== 'number') {
      console.warn('Invalid price:', priceInCents);
      return 'N/A';
    }
    return (priceInCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function calculateDiscountPercentage(regularPrice, specialPrice) {
    if (regularPrice && specialPrice && specialPrice < regularPrice) {
      return Math.round(((regularPrice - specialPrice) / regularPrice) * 100);
    }
    return 0;
  }

  // Loop through the products and create slide items
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    const slide = document.createElement('li');
    slide.classList.add('glide__slide');

    const productCard = document.createElement('div');
    productCard.classList.add('eva-chat-product-row-wrapper', 'product-card');

    const imageWrapper = document.createElement('div');
    imageWrapper.classList.add('product-image-wrapper');

    const productImage = document.createElement('img');
    productImage.classList.add('product-image');
    imageWrapper.appendChild(productImage);

    const descriptionWrapper = document.createElement('div');
    descriptionWrapper.classList.add('product-description-wrapper');

    const brand = document.createElement('p');
    brand.classList.add('product-brand');
    descriptionWrapper.appendChild(brand);

    const model = document.createElement('p');
    model.classList.add('product-model');
    descriptionWrapper.appendChild(model);

    const price = document.createElement('div');
    price.classList.add('product-price-wrapper');

    // Buttons container
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.classList.add('product-buttons-wrapper');

    // NEW: Custom quantity selector
    const quantityWrapper = document.createElement('div');
    quantityWrapper.classList.add('quantity-wrapper');

    const minusButton = document.createElement('button');
    minusButton.classList.add('quantity-btn', 'quantity-minus');
    minusButton.textContent = '–';
    quantityWrapper.appendChild(minusButton);

    const quantityDisplay = document.createElement('span');
    quantityDisplay.classList.add('quantity-display');
    quantityDisplay.textContent = '1'; // Default quantity
    quantityWrapper.appendChild(quantityDisplay);

    const plusButton = document.createElement('button');
    plusButton.classList.add('quantity-btn', 'quantity-plus');
    plusButton.textContent = '+';
    quantityWrapper.appendChild(plusButton);

    const addToCartButton = document.createElement('button');
    addToCartButton.classList.add('product-action-btn', 'add-to-cart-btn');
    addToCartButton.textContent = 'Add to Cart';
    buttonsWrapper.appendChild(quantityWrapper); // Add quantity selector before the button
    buttonsWrapper.appendChild(addToCartButton);

    const detailsButton = document.createElement('button');
    detailsButton.classList.add('product-action-btn', 'details-btn');
    detailsButton.textContent = 'Details';
    detailsButton.dataset.productHandle = product.handle; // Store handle for Shopify API
    buttonsWrapper.appendChild(detailsButton);

    try {
      // Fetch product data
      const response = await fetch(window.Shopify.routes.root + 'products/' + product.handle + '.js');
      const data = await response.json();

      // Brand, name
      brand.textContent = data.vendor;
      model.textContent = data.title;

      // Set the product title for the Add to Cart button
      addToCartButton.dataset.productTitle = data.title || 'Unknown Product'; // Fallback if title is missing
      console.log(`Set product title for Add to Cart button: ${addToCartButton.dataset.productTitle}`);

      // Product image
      if (data?.images[0]) {
        const originalURL = data.images[0];
        const smallerImgURL = originalURL.replace(/(\.[^/.]+)$/, '_400x400$1');
        productImage.src = smallerImgURL;
        productImage.alt = data.title;
      }

      // Prices
      const fetchedRegularPrice = data.compare_at_price;
      const fetchedSpecialPrice = data.price;
      const discountPercentage = calculateDiscountPercentage(fetchedRegularPrice, fetchedSpecialPrice);

      // Discount label
      if (discountPercentage > 0) {
        const discountLabel = document.createElement('div');
        discountLabel.classList.add('discount-label');
        discountLabel.textContent = `-${discountPercentage}%`;
        imageWrapper.appendChild(discountLabel);
      }

      if (fetchedSpecialPrice && fetchedRegularPrice && fetchedSpecialPrice < fetchedRegularPrice) {
        const newPrice = document.createElement('span');
        newPrice.classList.add('new-price');
        newPrice.textContent = formatPrice(fetchedSpecialPrice);
        price.appendChild(newPrice);

        const oldPrice = document.createElement('span');
        oldPrice.classList.add('old-price');
        oldPrice.textContent = formatPrice(fetchedRegularPrice);
        price.appendChild(oldPrice);
      } else {
        const productPrice = document.createElement('span');
        productPrice.classList.add('product-price');
        productPrice.textContent = formatPrice(fetchedRegularPrice || fetchedSpecialPrice);
        price.appendChild(productPrice);
      }
    } catch (error) {
      console.error('Error fetching product data:', error);
      // Fallback for Add to Cart button if fetch fails
      addToCartButton.dataset.productTitle = 'Unknown Product';
    }

    descriptionWrapper.appendChild(price);
    descriptionWrapper.appendChild(buttonsWrapper); // Add buttons below price

    // Build up the DOM structure
    productCard.appendChild(imageWrapper);
    productCard.appendChild(descriptionWrapper);
    slide.appendChild(productCard);
    glideSlides.appendChild(slide);
  }

  // Add all slides to the track
  glideTrack.appendChild(glideSlides);

  // --- Arrows container (existing code):
  const arrowsContainer = document.createElement('div');
  arrowsContainer.classList.add('glide__arrows');
  arrowsContainer.setAttribute('data-glide-el', 'controls');

  const leftArrow = document.querySelector('.left-arrow').cloneNode(true);
  leftArrow?.classList.remove("invisible");
  leftArrow?.classList.add('glide__arrow', 'glide__arrow--left');
  leftArrow?.setAttribute('data-glide-dir', '<');
  arrowsContainer.appendChild(leftArrow);

  const rightArrow = document.querySelector('.right-arrow').cloneNode(true);
  rightArrow.classList.remove("invisible");
  rightArrow.classList.add('glide__arrow', 'glide__arrow--right');
  rightArrow.setAttribute('data-glide-dir', '>');
  arrowsContainer.appendChild(rightArrow);

  // --- Bullets container for "dots" at the bottom
  const bulletsContainer = document.createElement('div');
  bulletsContainer.classList.add('glide__bullets');
  bulletsContainer.setAttribute('data-glide-el', 'controls[nav]');

  for (let i = 0; i < products.length; i++) {
    const bullet = document.createElement('button');
    bullet.classList.add('glide__bullet');
    bulletsContainer.appendChild(bullet);
  }

  // Append track, arrows, bullets to main container
  glideContainer.appendChild(glideTrack);
  glideContainer.appendChild(arrowsContainer);
  glideContainer.appendChild(bulletsContainer);

  return glideContainer;
}

async function mountProducts(prefix) {
  // Mount the Glide carousel
  const glide = new Glide('.glide-' + prefix, {
    type: 'carousel',
    perView: 1,
    focusAt: 'center',
    gap: 10
  });

  glide.mount();

  // Add event listeners for quantity buttons
  const quantityWrappers = document.querySelectorAll('.glide-' + prefix + ' .quantity-wrapper');
  quantityWrappers.forEach(wrapper => {
    const minusButton = wrapper.querySelector('.quantity-minus');
    const plusButton = wrapper.querySelector('.quantity-plus');
    const quantityDisplay = wrapper.querySelector('.quantity-display');

    minusButton.addEventListener('click', () => {
      let quantity = parseInt(quantityDisplay.textContent, 10);
      if (quantity > 1) {
        quantity--;
        quantityDisplay.textContent = quantity;
      }
    });

    plusButton.addEventListener('click', () => {
      let quantity = parseInt(quantityDisplay.textContent, 10);
      if (quantity < 10) { // Match max limit
        quantity++;
        quantityDisplay.textContent = quantity;
      }
    });
  });

  // Add event listeners to buttons after mounting
  const addToCartButtons = document.querySelectorAll('.glide-' + prefix + ' .add-to-cart-btn');
  addToCartButtons.forEach(button => {
    button.addEventListener('click', () => {
      const productTitle = button.dataset.productTitle;
      // Get the quantity from the display
      const quantityDisplay = button.parentElement.querySelector('.quantity-display');
      const quantity = parseInt(quantityDisplay.textContent, 10) || 1; // Fallback to 1 if invalid
      console.log(`Add to Cart clicked for product: ${productTitle}, quantity: ${quantity}`);
      handleUserQuery(`add ${quantity} ${productTitle} to cart`);
    });
  });

  const detailsButtons = document.querySelectorAll('.glide-' + prefix + ' .details-btn');
  detailsButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const handle = button.dataset.productHandle;
      try {
        const response = await fetch(window.Shopify.routes.root + 'products/' + handle + '.js');
        const data = await response.json();
        const description = data.description || "No description available.";
        sendMessageToAChat(MessageSender.bot, {
          message: `${data.title}:\n${description}`,
          emotion: "welcoming"
        });
      } catch (error) {
        console.error('Error fetching product details:', error);
        sendMessageToAChat(MessageSender.bot, {
          message: "Sorry, I couldn’t fetch the product details. Please try again later.",
          emotion: "sad",
          customClass: "error-message"
        });
      }
    });
  });
}
