import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), "dist", "client");
const cleanRoutes = ["boards", "admin", "events"];

for (const route of cleanRoutes) {
  const directory = join(output, route);
  await mkdir(directory, { recursive: true });
  await copyFile(join(output, `${route}.html`), join(directory, "index.html"));
}
