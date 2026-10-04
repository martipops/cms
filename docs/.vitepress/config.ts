import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'CMS',
  description: 'Schema-driven content editing for AdonisJS + Inertia + Vue + Nuxt UI sites',
  cleanUrls: true,
  // Private docs: keep them out of search engines
  head: [['meta', { name: 'robots', content: 'noindex, nofollow' }]],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/installing' },
      { text: 'Reference', link: '/schema' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Installing', link: '/installing' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Schema', link: '/schema' },
          { text: 'Server (Adonis)', link: '/server' },
          { text: 'Client (Vue)', link: '/client' },
          { text: 'Commit protocol', link: '/protocol' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Decisions', link: '/decisions' },
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/martipops/cms' }],
    editLink: {
      pattern: 'https://github.com/martipops/cms/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
