import type { MetadataRoute } from "next";

/** Lets phones add Habeas to the home screen with its own icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habeas: a fair process before anyone takes your tokens",
    short_name: "Habeas",
    description: "Freezes and take backs (clawbacks) on Stellar with a public reason, a deadline to answer and a neutral reviewer.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#f7f8f4",
    categories: ["finance", "utilities"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
