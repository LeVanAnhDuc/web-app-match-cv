// Text the tests assert on, copied verbatim with its source path, so a copy change is fixed here, not in specs.
//   UI text:        FE locale file, e.g. src/locales/en-US/pages/sign-in.ts
//   Server message: BE i18n/messages.properties, keyed by error code

export const copy = {
  // signIn: {
  //   // src/locales/en-US/pages/sign-in.ts → "signIn.title"
  //   title: "Sign in",
  // },
} as const;

export const serverMessage = {
  // messages.properties → TOK007
  // TOK007: "The username or password you entered is incorrect.",
} as const;
