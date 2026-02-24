import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const tsRecommended = tsPlugin.configs.recommended ?? { rules: {} };

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: globals.browser
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      ...tsRecommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off" // Отключаем для TypeScript, т.к. типизация уже есть через интерфейсы
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];
