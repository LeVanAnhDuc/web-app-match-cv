//  @ts-check

/** @type {import('prettier').Config & { tailwindStylesheet?: string }} */
const config = {
  bracketSpacing: true,
  printWidth: 80,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "none",
  quoteProps: "as-needed",
  endOfLine: "auto",
  arrowParens: "always",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind 4 has no JS config file, so point the class-sorting plugin at the
  // stylesheet holding `@import "tailwindcss"` — that is where the theme lives.
  tailwindStylesheet: "./src/styles.css"
};

export default config;
