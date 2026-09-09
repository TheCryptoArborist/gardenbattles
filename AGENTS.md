# Garden Battles deployment guardrails

These instructions apply to the entire repository.

## Current production architecture

- The live Garden Battles frontend is served at `https://nftree.net/battle`.
- Production files are shipped as an embedded bundle inside the separate repository `TheCryptoArborist/nftree_landing`, under `public/battle/`.
- The NFTree Netlify project is named `treenft`. It also serves the NFTree homepage, the Mischief Finance page, and NFTree Netlify Functions.
- The Garden Battles backend remains separate from this frontend release workflow.

## Prohibited deployment actions

- Never deploy this repository or any Garden Battles build directory directly to the Netlify `treenft` project.
- Never run `netlify deploy --prod`, `netlify deploy -p`, `npx netlify ... --prod`, or an equivalent CLI, MCP, API, or drag-and-drop production publish targeting `treenft`.
- Never run `netlify link` from this repository to `treenft`.
- Never publish `dist`, `dist/public`, `server/public`, `trials`, `leaderboard`, or another partial Garden Battles directory as the root of `nftree.net`.
- Do not overwrite or remove the NFTree homepage, ambassador routes, Netlify Functions, or root routing configuration.

## Safe Garden Battles release workflow

1. Make and validate Garden Battles changes in this repository.
2. Build the browser application using the established Garden Battles build command.
3. Copy the completed browser bundle into the sibling NFTree repository at `nftree_landing/public/battle/` only.
4. In `nftree_landing`, verify that the NFTree root site and all Garden Battles entry pages remain present.
5. Run the NFTree repository's full validation/build command.
6. Commit the `public/battle/` update in `TheCryptoArborist/nftree_landing` and publish through its Git-connected `main` workflow.
7. Let Netlify deploy the entire NFTree repository. Do not perform a local production deploy.

## Required stop conditions

- Stop if the sibling `nftree_landing` repository is missing, dirty in unrelated files, or not synchronized with its remote branch.
- Stop if the proposed copy would modify anything outside `public/battle/` unless the task explicitly requires and reviews that additional change.
- Stop if any instruction asks for a direct production upload to `treenft`; use the Git handoff workflow instead.
- Preserve the currently deployed Garden Battles bundle unless the user explicitly authorizes a new Garden Battles release.
