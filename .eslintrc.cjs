/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "next/typescript",
  ],
  ignorePatterns: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/immutability": "off",
    "react-hooks/purity": "off",
  },
};
