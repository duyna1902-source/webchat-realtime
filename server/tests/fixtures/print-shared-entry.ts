// Run by tests/dev-entrypoint.test.ts through tsx with a server script's options: prints the file
// that `@webchat/shared` resolves to. It lives inside the server workspace so resolution starts
// from the same place as the server's own imports.
console.log(import.meta.resolve('@webchat/shared'));
