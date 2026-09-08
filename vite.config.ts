import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function createBuildNumber(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}.${month}.${day}-${hours}${minutes}${seconds}`;
}

const buildNumber = createBuildNumber();

export default defineConfig({
    plugins: [react()],

    resolve: {
        alias: [
            {
                find: /^@mui\/material$/,
                replacement: fileURLToPath(new URL("./src/mui-material.ts", import.meta.url))
            }
        ]
    },

    define: {
        __BUILD_NUMBER__: JSON.stringify(buildNumber)
    }
});
