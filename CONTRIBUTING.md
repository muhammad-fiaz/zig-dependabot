# Contributing

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development

The project is built with TypeScript and Bun.

### prerequisites

- [Bun](https://bun.sh) (latest)
- [Zig](https://ziglang.org) (master, for testing updates)

### Steps

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Run tests**

   ```bash
   bun run test
   ```

3. **Build**

   ```bash
   bun run build
   ```

4. **Type check**
   ```bash
   bun x tsc --noEmit
   ```

## Pull Requests

1. Fork the repo and create your branch from `main`.
2. Be sure to run tests and linters.
3. Update the README.md with details of changes to the interface, if applicable.
4. Issue that pull request!

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
