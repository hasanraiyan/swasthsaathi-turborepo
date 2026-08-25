# swasthsaathi

A Turborepo monorepo with a NestJS API and an Expo (React Native) mobile app, both in TypeScript.

## What's inside?

### Apps and Packages

- `apps/api`: a [NestJS](https://nestjs.com/) app
- `apps/mobile`: an [Expo](https://expo.dev/) (React Native) app
- `@repo/eslint-config`: shared `eslint` configurations
- `@repo/typescript-config`: shared `tsconfig.json`s

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Turborepo](https://turborepo.dev) for task orchestration/caching

## Getting started

```sh
pnpm install
```

### Develop

```sh
pnpm dev            # runs api + mobile dev servers together
pnpm --filter api dev
pnpm --filter mobile dev
```

### Build

```sh
pnpm build
```

### Lint / type-check

```sh
pnpm lint
pnpm check-types
```
