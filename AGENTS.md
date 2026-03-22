## Communications

- You can use English or Russian for communication. No other languages.
- You MUST write all documents and comments in English.

## Project documentation guidelines for implementation and planning

- When you're in planning mode you (usually planning feature and implementation details) you should challenge user with questions to clarify the requirements, edge cases, and constraints. The more details you have the better implementation you can provide. You should challenge the user to think through the feature from different angles (user experience, business logic, technical implementation) to ensure a comprehensive understanding before you start writing code. This will help you identify potential issues early and design a more robust solution. You should try to guide the user to go deeper into the problem the user is trying to solve with the feature, and encourage them to articulate the "why" behind the feature, not just the "what". This will help you align your implementation with the underlying goals and motivations, leading to a more effective and impactful solution.
- Every time you're planning a new feature/implementation you should consult with /specs/product.md, /specs/architecture.md, /specs/infra.md, /specs/db.md, and /specs/features.md to ensure your approach aligns with the overall product vision and architectural guidelines and target infrastructure. If implementation is touching any of the existing features - follow the relevant feature file for detailed guidance on business logic and implementation notes.
- When user asks to update the documentation that means you need:
  - If there are any changes to the overall architecture or new components introduced, also update /specs/architecture.md to reflect those changes.
  - If there are any changes to the database schema or new database components introduced, also update /specs/db.md to reflect those changes. db.md file should always be up to date with the actual database schema and include comments and explanations for the schema design decisions, relationships, and any relevant implementation details to ensure it serves as a reliable reference for developers and stakeholders. This will help maintain clarity and consistency in the database design and facilitate better understanding and collaboration among team members. It should also include comments on a business logic meaning of each table, field, and relation, and how they relate to the overall product features and user experience.
  - If there are any changes on how the application should be built during CI/CD process (or CI/CD process itself), deployed, hosted, or any new infrastructure components are introduced, update /specs/infra.md accordingly.
  - If the feature impacts the product vision or user experience in a significant way, update /specs/product.md as well to ensure it remains an accurate representation of the product's goals and value proposition.
  - Update the relevant feature files in /specs/features/ (e.g. if it's about chat summarisation, update /specs/features/05-chat-summarisation.md) with the new implementation details and any changes to the business logic or user experience.
  - If new features implemented, add them to the index in /specs/features.md with a link to their respective feature file (create it).
  - If new implementation cancels/deleted any feature - remove the feature description file and update the index in /specs/features.md accordingly.
  - Make sure to maintain consistency in terminology, formatting, and level of detail across all documentation files for a cohesive and professional presentation.

## Dependencies management

Always use the latest stable versions of packages.

### Rules

- ALWAYS ask user approval before introducing a new dependency to the project. Explain why it's needed, what problem it solves, alternatives and reasoning why it's the best choice. This ensures that every dependency is intentional and justified, keeping the project lean and maintainable.
- NEVER manually specify or pin outdated versions in `package.json`.
- NEVER copy dependency versions from examples, tutorials, or other repositories.
- ALWAYS query the registry to determine the latest stable version before installing a package.
- Prefer installation commands instead of manual editing of `package.json`.

### Correct workflow

The project uses pnpm as the package manager. Never use npm or yarn.

When adding a dependency:

- Check the latest version in the npm registry.
- Install it using the package manager.
- Let the package manager update `package.json`.
- When installing dependencies always use: @latest

Example:

pnpm add <package>@latest

Do NOT manually edit `package.json` to add dependencies.

### Version policy

- Use the latest stable version available in npm.
- Do not install deprecated packages.
- Avoid outdated major versions unless explicitly required.

### Updating dependencies

When modifying existing dependencies:

- Check the latest available version.
- Prefer upgrading to the newest compatible version.
- Run the package manager update command instead of editing versions manually.

Examples:

pnpm up
pnpm up --latest

### When unsure

If dependency version choice is unclear:

- Inspect npm registry.
- Choose the latest stable version.
- Avoid legacy versions unless the project explicitly requires them.
