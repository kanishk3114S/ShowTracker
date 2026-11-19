/**
 * Text sanitizing for everything a user can type (display name, bio, notes, group names).
 *
 * React already escapes text on output, so this is defence in depth: stored text can never carry
 * markup or invisible tricks into any other consumer (emails, exports, a future non-React client).
 *
 *   - removes HTML-like tags (`<script>`, `<img onerror=...>`, `</b>`); "I <3 anime" is kept
 *   - removes control characters and the invisible bidi-override characters used for spoofing
 *   - keeps tabs and line breaks (cleanText) or collapses all whitespace (cleanLine)
 */
const TAG = /<\/?[a-zA-Z!?][^>]*>/g;
// C0 controls except \t \n \r, DEL, zero-width + bidi marks/overrides/isolates
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

function stripTags(value) {
  let out = value;
  // a few passes so nested attempts like "<<b>script>" cannot reassemble into a tag
  for (let i = 0; i < 4; i++) {
    const next = out.replace(TAG, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Multi-line text (bio, notes, descriptions): tags and invisibles removed, line breaks kept. */
export function cleanText(value) {
  return stripTags(String(value ?? '').normalize('NFC').replace(INVISIBLE, ''));
}

/** Single-line text (names): as cleanText, with every run of whitespace collapsed to one space. */
export function cleanLine(value) {
  return cleanText(value).replace(/\s+/g, ' ').trim();
}
