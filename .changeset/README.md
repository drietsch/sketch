# Changesets

Release notes are collected as changesets. Run `pnpm changeset` after a
user-visible change, commit the generated file, and `pnpm version-packages`
folds them into `CHANGELOG.md` and bumps the version at release time.
