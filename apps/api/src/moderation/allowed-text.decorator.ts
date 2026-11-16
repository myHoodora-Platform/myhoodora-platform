import { registerDecorator, type ValidationOptions } from "class-validator";
import { BLOCKED_TEXT_MESSAGE, isAllowedText } from "./content-filter";

/**
 * On a DTO field people write and others see: the request is refused (400, a message the apps show as
 * written) when the text matches the content filter (content-filter.ts). Works on strings and arrays of
 * strings; anything else is left to the field's other rules.
 */
export function AllowedText(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: "allowedText",
      target: object.constructor,
      propertyName: propertyName as string,
      options: { message: BLOCKED_TEXT_MESSAGE, ...options },
      validator: {
        validate(value: unknown) {
          if (typeof value === "string") return isAllowedText(value);
          if (Array.isArray(value)) return value.every((v) => typeof v !== "string" || isAllowedText(v));
          return true;
        },
      },
    });
  };
}
