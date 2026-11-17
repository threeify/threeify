const clidocPlugin = require('@clidoc/docusaurus');

module.exports = {
  title: 'Land of Assets Docs',
  tagline: 'CLI, SDK, and REST API reference for Land of Assets.',
  favicon: 'img/logo.svg',
  url: process.env.SITE_URL ?? 'https://docs.landofassets.com',
  baseUrl: process.env.BASE_URL ?? '/',
  organizationName: 'drivecore',
  projectName: 'loa',
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
        specs: [
          { id: 'api', spec: process.env.OPENAPI_URL ?? 'https://api.landofassets.com/docs/json', route: '/api' },
        ],
        theme: { primaryColor: '#173f9b' },
      },
    ],
  ],
  plugins: [[clidocPlugin, { input: '.generated/loa.json', outputDir: 'docs/cli', basePath: '/cli' }]],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Land of Assets',
      logo: { alt: 'Land of Assets', src: 'img/logo.png', height: 32, width: 32 },
      items: [
        { to: '/asset-manager', label: 'Asset manager', position: 'left' },
        { to: '/cli', label: 'CLI', position: 'left' },
        { to: '/sdk', label: 'SDK', position: 'left' },
        { to: '/api', label: 'REST API', position: 'left' },
        { href: 'https://landofassets.com', label: 'Land of Assets', position: 'right' },
        { href: 'https://github.com/drivecore/loa', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://landofassets.com">Land of Assets</a> · SDK and CLI are MIT licensed`,
    },
  },
};
