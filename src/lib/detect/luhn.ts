/**
 * Luhn algorithm for validating card numbers
 * Used to reduce false positives when detecting payment card numbers
 */
export function luhnCheck(digits: string): boolean {
  // Handle edge cases
  if (!digits || digits.length === 0) return false;
  if (!/^\d+$/.test(digits)) return false; // Only digits allowed
  if (/^0+$/.test(digits)) return false; // All zeros is invalid

  let sum = 0;
  let alt = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }

  return sum % 10 === 0;
}
