module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        Date: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        Promise: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
];
