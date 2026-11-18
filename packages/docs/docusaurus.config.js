const clidocPlugin = require('@clidoc/docusaurus');

module.exports = {
  title: 'Threeify Docs',
  tagline: 'CLI, SDK, and REST API reference for Threeify.',
  favicon: 'img/logo.svg',
  url: process.env.SITE_URL ?? 'https://docs.landofassets.com',
  baseUrl: process.env.BASE_URL ?? '/',
  organizationName: 'threeify',
  projectName: 'threeify',
  onBrokenLinks: 'throw',
  markdown: { format: 'md' },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.js' },
        pages: { path: 'pages' },
        blog: false,
        theme: { customCss: './css/custom.css' },
      },
    ],
    [
      'redocusaurus',
      {
        // The production API serves its OpenAPI document; it is fetched and rendered at build time.
        specs: [{ id: 'api', spec: process.env.OPENAPI_URL ?? 'https://api.threeify.com/docs/json', route: '/api' }],
        theme: { primaryColor: '#173f9b' },
      },
    ],
  ],
  plugins: [[clidocPlugin, { input: '.generated/threeify.json', outputDir: 'docs/cli', basePath: '/cli' }]],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Threeify',
      logo: { alt: 'Threeify', src: 'img/logo.png', height: 32, width: 32 },
      items: [
        { to: '/asset-manager', label: 'Asset manager', position: 'left' },
        {
          label: 'CLI',
          position: 'left',
          items: [
            { to: '/cli-guide', label: 'Guide' },
            { to: '/cli', label: 'Command reference' },
          ],
        },
        {
          label: 'SDK',
          position: 'left',
          items: [
            { to: '/sdk-guide', label: 'Guide' },
            { to: '/sdk', label: 'API reference' },
          ],
        },
        { to: '/runtime-guide', label: 'Runtime', position: 'left' },
        { to: '/api', label: 'REST API', position: 'left' },
        { href: 'https://threeify.com', label: 'Threeify', position: 'right' },
        { href: 'https://github.com/threeify/threeify', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://threeify.com">Threeify</a> · SDK and CLI are MIT licensed`,
    },
  },
};
