import { applyDecorators } from '@nestjs/common';
import { IsString, MaxLength, Matches, MinLength } from 'class-validator';

/**
 * Password policy for any endpoint that SETS a password (change, admin reset,
 * user create). Min 10 chars, at least one letter and one number, capped to a
 * sane max. (Login itself is not re-validated against the policy.)
 */
export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(10, { message: 'Password must be at least 10 characters.' }),
    MaxLength(128, { message: 'Password is too long.' }),
    Matches(/[A-Za-z]/, { message: 'Password must include a letter.' }),
    Matches(/[0-9]/, { message: 'Password must include a number.' }),
  );
}
