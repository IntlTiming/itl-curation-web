import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import emojiRegexFactory from 'emoji-regex';

// emoji-regex only matches emoji anywhere in a string, so this asserts the WHOLE string is
// exactly one emoji grapheme cluster - the server-side backstop against a client sending
// arbitrary text through the reaction endpoint (the frontend's full emoji picker only ever
// produces single emoji, but that's a UI constraint, not a validation one).
function isSingleEmoji(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const matches = value.match(emojiRegexFactory());
  return matches !== null && matches.length === 1 && matches[0] === value;
}

export function IsSingleEmoji(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSingleEmoji',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return isSingleEmoji(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'emoji must be a single emoji character';
        },
      },
    });
  };
}
