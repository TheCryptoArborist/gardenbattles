import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const dependencyRoot = path.resolve(rootDir, "../nftree_rewards/node_modules");

function dependencyPath(packagePath) {
  return path.join(dependencyRoot, packagePath);
}

export default {
  root: rootDir,
  resolve: {
    alias: {
      "@mysten/sui/client": dependencyPath("@mysten/sui/dist/client/index.mjs"),
      "@mysten/sui/jsonRpc": dependencyPath("@mysten/sui/dist/jsonRpc/index.mjs"),
      "@mysten/sui/transactions": dependencyPath("@mysten/sui/dist/transactions/index.mjs"),
      "@mysten/sui/utils": dependencyPath("@mysten/sui/dist/utils/index.mjs"),
      "@mysten/sui/bcs": dependencyPath("@mysten/sui/dist/bcs/index.mjs"),
      "@mysten/wallet-standard": dependencyPath("@mysten/wallet-standard/dist/index.mjs"),
      "@wallet-standard/core": dependencyPath("@wallet-standard/core/lib/esm/index.js"),
    },
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(rootDir, "src/wallet-mint.js"),
      formats: ["iife"],
      name: "NFTreeWalletMintBundle",
      fileName: () => "nftree-wallet-mint.js",
    },
    outDir: path.resolve(rootDir, "public/assets"),
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
};
