#!/bin/bash

# Install dependencies if not present
echo "Installing Husky..."
pnpm add -Dw husky

# Initialize Husky
echo "Initializing Husky..."
pnpm exec husky init

# Create pre-commit hook
echo "Setting up pre-commit hook..."
echo "pnpm lint && pnpm check-types" > .husky/pre-commit

# Create pre-push hook
echo "Setting up pre-push hook..."
echo "pnpm test" > .husky/pre-push

# Make hooks executable
chmod +x .husky/pre-commit .husky/pre-push

echo "Husky Git hooks set up successfully!"
echo "Note: You can bypass hooks using --no-verify (e.g., git commit -m 'feat: bypass' --no-verify)"
