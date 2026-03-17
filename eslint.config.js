import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/pkg/**",
      "**/target/**",
      "**/fixtures/**",
      "**/coverage/**",
      "**/*.js",
      "!eslint.config.js",
    ],
  },

  // Base TypeScript config for all packages
  ...tseslint.configs.recommended,

  // Project-specific rules
  {
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": "warn",
    },
  },
);
