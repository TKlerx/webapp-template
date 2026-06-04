import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "webapp-template", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
