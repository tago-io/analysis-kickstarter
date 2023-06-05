module.exports = {
  env: {
    node: true,
    jest: true,
    es2021: true
  },
  root: true,
  ignorePatterns: [
    ".eslintrc.js",
    "tsconfig.json"
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: false,
    },
    tsconfigRootDir: __dirname,
    project: [
      "./tsconfig.json",
    ],
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "jest", "functional", "unicorn"],
  extends: [
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:import/typescript"
  ],
  rules: {
    "semi": [2, "always"],
    "import/order": 1,
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        //? Ignore unused args in functions if arg starts with '_'
        "argsIgnorePattern": "^_"
      }
    ],
    "curly": ["error", "all"],
    "import/exports-last": 1,
    "import/first": 1,
    "import/newline-after-import": 1,
    "import/no-absolute-path": 2,
    "import/no-default-export": 1,
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-unsafe-member-access": 0,
    "@typescript-eslint/no-unsafe-argument": 0,
    "@typescript-eslint/no-unsafe-assignment": 0,
    "@typescript-eslint/no-unsafe-return": 0,
    "@typescript-eslint/no-unsafe-call": 0,
    "@typescript-eslint/no-misused-promises": 0,
    "@typescript-eslint/no-floating-promises": 1,
    "@typescript-eslint/restrict-template-expressions": 0,
    "@typescript-eslint/require-await": 0,
    "functional/no-class": 0,
    "functional/prefer-tacit": 0,
    "unicorn/catch-error-name": 1,
    "unicorn/consistent-destructuring": 1,
    "unicorn/error-message": 2,
    "unicorn/expiring-todo-comments": 2, // So nice, check on https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v41.0.1/docs/rules/expiring-todo-comments.md
    "unicorn/explicit-length-check": 1,
    "unicorn/filename-case": 1,
    "unicorn/new-for-builtins": 2,
    "unicorn/no-array-callback-reference": 1,
    "unicorn/no-array-for-each": 1,
    "unicorn/no-array-method-this-argument": 2,
    "unicorn/no-instanceof-array": 2,
    "unicorn/no-invalid-remove-event-listener": 2,
    "unicorn/no-lonely-if": 1,
    "unicorn/no-new-array": 2,
    "unicorn/no-new-buffer": 2,
    "unicorn/no-object-as-default-parameter": 1,
    "unicorn/no-useless-spread": 1,
    "unicorn/number-literal-case": 1,
    "unicorn/numeric-separators-style": 1,
    "unicorn/prefer-array-find": 1,
    "unicorn/prefer-array-flat": 1,
    "unicorn/prefer-array-flat-map": 1,
    "unicorn/prefer-array-index-of": 1,
    "unicorn/prefer-array-some": 1,
    "unicorn/prefer-at": 1,
    "unicorn/prefer-code-point": 1,
    "unicorn/prefer-date-now": 1,
    "unicorn/prefer-export-from": 1,
    "unicorn/prefer-includes": 1,
    "unicorn/prefer-json-parse-buffer": 1,
    "unicorn/prefer-negative-index": 1,
    "unicorn/prefer-negative-index": 1,
    "unicorn/prefer-optional-catch-binding": 1,
    "unicorn/prefer-set-has": 1,
    "unicorn/prefer-string-replace-all": 1,
    "unicorn/prefer-string-slice": 1,
    "unicorn/template-indent": 1,
    "unicorn/throw-new-error": 2
  }
};
