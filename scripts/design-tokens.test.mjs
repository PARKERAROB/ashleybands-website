// Design token guard (#132). Keeps components/ui on the shared tokens in app/tokens.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const uiDir = join(root, "components", "ui");
const tokensPath = join(root, "app", "tokens.css");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const definedIn = (css) => new Set([...stripComments(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const referencedIn = (text) => [...stripComments(text).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);

const uiFiles = walk(uiDir);
const cssFiles = uiFiles.filter((file) => file.endsWith(".css"));
const tokens = definedIn(readFileSync(tokensPath, "utf8"));

test("app/tokens.css defines the core palette, type, space, radius and shadow tokens", () => {
  const required = [
    "--ink", "--paper", "--paper-strong", "--garnet", "--garnet-dark", "--gold", "--gold-text", "--line", "--muted",
    "--surface", "--surface-raised", "--border", "--text", "--text-muted", "--accent",
    "--danger", "--success", "--warning", "--focus",
    "--font-display", "--font-body",
    "--step--1", "--step-0", "--step-1", "--step-2", "--step-3", "--step-4",
    "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7", "--space-8",
    "--radius-sm", "--radius-md", "--radius-pill", "--shadow"
  ];
  const missing = required.filter((name) => !tokens.has(name));
  assert.deepEqual(missing, [], `missing tokens: ${missing.join(", ")}`);
});

test("app/layout.jsx loads tokens.css before styles.css", () => {
  const layout = readFileSync(join(root, "app", "layout.jsx"), "utf8");
  const tokensAt = layout.indexOf('import "./tokens.css"');
  const stylesAt = layout.indexOf('import "./styles.css"');
  assert.ok(tokensAt !== -1, "layout imports tokens.css");
  assert.ok(stylesAt === -1 || tokensAt < stylesAt, "tokens.css is imported first");
});

test("components/ui has one CSS module per part", () => {
  assert.ok(cssFiles.length >= 8, `expected the shared parts' CSS modules, found ${cssFiles.length}`);
  for (const file of cssFiles) assert.match(file, /\.module\.css$/, `${relative(root, file)} should be a CSS module`);
});

test("components/ui CSS uses no raw hex colors", () => {
  const offenders = [];
  for (const file of cssFiles) {
    const css = stripComments(readFileSync(file, "utf8"));
    for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) offenders.push(`${relative(root, file)}: ${match[0]}`);
  }
  assert.deepEqual(offenders, [], "use a token from app/tokens.css instead of a hex color");
});

test("every var(--token) in components/ui exists in app/tokens.css or is defined locally", () => {
  const unknown = [];
  for (const file of uiFiles.filter((f) => /\.(css|jsx?|mjs)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    const local = file.endsWith(".css") ? definedIn(text) : new Set();
    for (const name of referencedIn(text)) {
      if (!tokens.has(name) && !local.has(name)) unknown.push(`${relative(root, file)}: ${name}`);
    }
  }
  assert.deepEqual(unknown, [], "add the token to app/tokens.css or fix the name");
});

test("the guard catches a raw hex and an unknown token", () => {
  const sample = ".x { color: #7b1829; background: var(--not-a-token); border-color: var(--garnet); }";
  assert.equal([...stripComments(sample).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].length, 1);
  assert.deepEqual(referencedIn(sample).filter((name) => !tokens.has(name)), ["--not-a-token"]);
});
