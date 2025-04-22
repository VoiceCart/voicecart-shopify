import shopify from '../shopify.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const client = new shopify.api.rest.Asset({ session });

  const themes = await shopify.api.rest.Theme.all({ session });
  const mainTheme = themes.find((t) => t.role === 'main');

  const asset = await shopify.api.rest.Asset.update({
    session,
    theme_id: mainTheme.id,
    key: 'templates/index.json',
    value: JSON.stringify({
      sections: {
        main: { type: 'main' },
        'app-block': { type: 'apps.my-app-block.app-window' }
      },
      order: ['app-block', 'main']
    })
  });

  return null;
};
