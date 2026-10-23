// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Error type for sign-in / permission problems, shown to people as-is.
export class AuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
