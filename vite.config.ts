import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

export default defineConfig({
  base:"/project-anime/",
  define:{
    __DEPLOYED_AT__:JSON.stringify(new Date().toISOString())
  },
  plugins:[react(),VitePWA({
    registerType:"autoUpdate",
    includeAssets:["covers/*.{jpg,jpeg,png,webp}"],
    manifest:{
      name:"The Watchlist",
      short_name:"Watchlist",
      description:"Richie’s personal anime library",
      theme_color:"#09090b",
      background_color:"#09090b",
      display:"standalone",
      orientation:"portrait-primary",
      start_url:"/project-anime/",
      scope:"/project-anime/",
      categories:["entertainment","lifestyle"]
    },
    workbox:{
      globPatterns:["**/*.{js,css,html,json,jpg,jpeg,png,webp,svg}"],
      globIgnores:["anime-index.json"],
      cleanupOutdatedCaches:true,
      skipWaiting:true,
      clientsClaim:true,
      navigateFallback:"/project-anime/index.html",
      runtimeCaching:[{
        urlPattern:({request})=>request.destination==="image",
        handler:"CacheFirst",
        options:{cacheName:"watchlist-covers",expiration:{maxEntries:500,maxAgeSeconds:60*60*24*90}}
      }]
    }
  })]
});
