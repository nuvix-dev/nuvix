export default function emailValidator(email: string): boolean {
  // Regular expression for validating email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email);
}
