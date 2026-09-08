import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function stableSelectImports(): Plugin {
    return {
        name: "stable-select-imports",
        enforce: "pre",
        transform(code, id) {
            if (!/[\\/]src[\\/].*\\.(?:ts|tsx)$/.test(id) || !code.includes("@mui/material")) return null;

            let replacedSelect = false;
            const transformed = code.replace(
                /import\s*\{([\s\S]*?)\}\s*from\s*["']@mui\/material["'];?/g,
                (fullImport, specifierBlock: string) => {
                    let removedFromThisImport = false;
                    const remaining = specifierBlock
                        .split(",")
                        .map((specifier) => specifier.trim())
                        .filter(Boolean)
                        .filter((specifier) => {
                            if (specifier === "Select") {
                                removedFromThisImport = true;
                                replacedSelect = true;
                                return false;
                            }
                            return true;
                        });

                    if (!removedFromThisImport) return fullImport;
                    return remaining.length > 0
                        ? `import { ${remaining.join(", ")} } from "@mui/material";`
                        : "";
                }
            );

            if (!replacedSelect) return null;
            return {
                code: `import Select from "/src/components/StableSelect.tsx";\n${transformed}`,
                map: null
            };
        }
    };
}

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
    plugins: [stableSelectImports(), react()],

    define: {
        __BUILD_NUMBER__: JSON.stringify(buildNumber)
    }
});
