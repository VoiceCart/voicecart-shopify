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

    try {
      // Fetch product data
      const response = await fetch(window.Shopify.routes.root + 'products/' + product.handle + '.js');
      const data = await response.json();

      // Brand, name
      brand.textContent = data.vendor;
      model.textContent = data.title;

      // Product image
      if (data?.images[0]) {
        const originalURL = data.images[0];
        // Request a smaller 400x400 image from Shopify's CDN
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
    }

    descriptionWrapper.appendChild(price);

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

  // --- NEW: Bullets container for "dots" at the bottom
  const bulletsContainer = document.createElement('div');              // <-- new
  bulletsContainer.classList.add('glide__bullets');                    // <-- new
  bulletsContainer.setAttribute('data-glide-el', 'controls[nav]');     // <-- new

  // Create one bullet per product
  for (let i = 0; i < products.length; i++) {                           // <-- new
    const bullet = document.createElement('button');                   // <-- new
    bullet.classList.add('glide__bullet');
    // bullet.setAttribute('data-glide-dir', `=${i}`);
    bulletsContainer.appendChild(bullet);                              // <-- new
  }                                                                     // <-- new

  // Append track, arrows, bullets to main container
  glideContainer.appendChild(glideTrack);
  glideContainer.appendChild(arrowsContainer);
  glideContainer.appendChild(bulletsContainer);                        // <-- new

  return glideContainer;
}

async function mountProducts(prefix) {
  // The standard Glide init
  await (new Glide('.glide-'+prefix, {
    type: 'carousel',
    perView: 1,
    focusAt: 'center',
    gap: 10
  })).mount();
}
