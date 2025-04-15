import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsUID(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUniqueID',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const regex = /^(?:[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}|unique\(\))$/;
          return typeof value === 'string' && regex.test(value);
        },
        defaultMessage() {
          return `${propertyName} must be either "unique()" or alphanumeric and can include period, hyphen, and underscore. Cannot start with a special character. Max length is 36 chars.`;
        },
      },
    });
  };
}

export function IsKey(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isKey',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const regex = /^[a-zA-Z0-9_]+$/;
          return typeof value === 'string' && regex.test(value);
        },
        defaultMessage() {
          return `${propertyName} must be alphanumeric and can include underscore. Cannot start with a special character.`;
        },
      },
    });
  };
}
