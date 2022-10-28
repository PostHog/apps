# PostHog Apps

This is the main mono-repo for official PostHog Apps.

## Updating existing plugins

### Bump versions for all existing plugins

```
yarn workspaces foreach version [patch | minor | major | prerelease] --deferred
yarn version apply --all
```

## Creating a new plugin _(WIP)_

To create a new plugin, simply add a new folder to the `src/packages/` directory and initialize it with a `package.json`.

### Typescript

Base `tsconfig.json`:

```
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    // Any options you would like to override
  }
}
```
