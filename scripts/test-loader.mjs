import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return {
        url: "data:text/javascript,export default {}",
        shortCircuit: true,
      };
    let base;
    if (specifier.startsWith("@/"))
      base = path.resolve("src", specifier.slice(2));
    else if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith("file:")
    )
      base = path.resolve(
        path.dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
    if (base)
      for (const ext of ["", ".ts", ".tsx", "/index.ts"])
        if (existsSync(base + ext) && /\.(ts|tsx)$/.test(base + ext))
          return { url: pathToFileURL(base + ext).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && /\.(ts|tsx)$/.test(url))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
