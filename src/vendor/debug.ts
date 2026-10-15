// Stands in for the Skypack `debug` that grammY's Deno build imports (see deno.json imports),
// backed by jsr:@grammyjs/debug, which reads the DEBUG env var itself.
import { createDebug } from "@grammyjs/debug";

const debug = Object.assign((namespace: string) => createDebug(namespace), {
  useColors: () => !Deno.noColor,
  enable: (_namespaces: string) => {},
  disable: () => {},
});
export default debug;
