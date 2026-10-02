import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" lets the built files run from any folder on Hostinger (public_html or a subfolder)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
