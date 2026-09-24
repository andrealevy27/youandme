import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types";
import { isValidStorageKey } from "./validation";

/** Development driver: files under ./uploads, served by `src/app/uploads/[...key]/route.ts`. */
export function createLocalDriver(root = path.join(process.cwd(), "uploads")): StorageDriver {
  const resolve = (key: string) => {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
    const full = path.resolve(root, key);
    // Defence in depth against traversal even though keys are pattern-checked.
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  };
  return {
    name: "local",
    async put(key, body) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body, { flag: "wx" });
    },
    async get(key) {
      const full = resolve(key);
      try {
        const [body, info] = await Promise.all([readFile(full), stat(full)]);
        return { body: new Uint8Array(body), contentType: null, size: info.size };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    publicUrl(key) {
      return `/uploads/${key}`;
    },
  };
}
