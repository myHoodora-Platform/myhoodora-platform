import { config as baseConfig } from "@myhoodora/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // A bare @SkipThrottle() only skips a limit named "default", and none of ours is (shared/throttle/throttle.guards.ts).
      "no-restricted-syntax": [
        "error",
        { selector: "Decorator > CallExpression[callee.name='SkipThrottle'][arguments.length=0]", message: "@SkipThrottle() skips nothing here: use @NoRateLimit(), or name the limits to skip." },
      ],
    },
  },
];
