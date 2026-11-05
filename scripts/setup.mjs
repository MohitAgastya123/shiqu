// Validate the development runtime; provider setup belongs to the shared desktop/CLI store.
// The package setup script installs the lockfile and hooks after this check.
if (Number(process.versions.node.split('.')[0]) !== 24) {
  throw new Error(`Node 24 is required; see .nvmrc. Current version: ${process.versions.node}`);
}
console.log('Development reuses saved desktop/CLI settings. Configure with pnpm cli --configure; project .env is not loaded by the development backend.');
