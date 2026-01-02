import { defineConfig } from "vitepress";

export default defineConfig({
  title: "dittory",
  description:
    "A static analysis CLI tool that detects parameters always receiving the same value",
  lang: "en-US",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#646cff" }],
  ],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Config", link: "/config/" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/dittory",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is dittory?", link: "/guide/what-is-dittory" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Usage",
          items: [
            { text: "CLI Options", link: "/guide/cli-options" },
            { text: "Disabling Detection", link: "/guide/disabling-detection" },
          ],
        },
      ],
      "/config/": [
        {
          text: "Configuration",
          items: [
            { text: "Config File", link: "/config/" },
            { text: "Options Reference", link: "/config/options" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/warabi1062/dittory" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright (c) warabi1062",
    },

    search: {
      provider: "local",
    },
  },
});
