import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plusieurs lockfiles existent dans l'arborescence utilisateur : sans ça,
  // Turbopack infère C:\Users\fallo comme racine du workspace.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Médias générés après le build : servis par src/app/media (sinon 404 en prod).
  async rewrites() {
    return [
      {
        source: "/:dir(generated-carousels|generated-images|generated-shorts|generated-thumbnails|content-out)/:file*",
        destination: "/media/:dir/:file*",
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    localPatterns: [
      { pathname: "/avatars/**", search: "?v=3" },
      { pathname: "/avatars/**", search: "?v=4-funko" },
      { pathname: "/avatars/**", search: "?v=5-cutout" },
      { pathname: "/avatars/**", search: "" },
      { pathname: "/avatars-pixel/**", search: "?v=4-pixel" },
      { pathname: "/avatars-pixel/**", search: "?v=5-svg" },
      { pathname: "/avatars-pixel/**", search: "" },
      // Photos des 6 agents (refonte 2026) — sinon next/image renvoie 400.
      { pathname: "/agents/**", search: "" },
    ],
  },
};

export default nextConfig;
