import { timingSafeEqual } from "crypto";

// Plain `===`/`!==` on secrets is vulnerable in theory to timing attacks
// (comparison short-circuits on the first mismatched byte, so response
// time leaks how many leading characters were correct). Used for CRON_SECRET
// checks — see src/app/api/cron/*.
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, and only compares equal-length buffers.
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
