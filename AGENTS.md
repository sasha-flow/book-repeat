## Communications

- You can use English or Russian for communication. No other languages.
- You MUST write all documents and comments in English.

## Project documentation guidelines for implementation and planning

- When you're in planning mode you (usually planning feature and implementation details) you should challenge user with questions to clarify the requirements, edge cases, and constraints. The more details you have the better implementation you can provide. You should challenge the user to think through the feature from different angles (user experience, business logic, technical implementation) to ensure a comprehensive understanding before you start writing code. This will help you identify potential issues early and design a more robust solution. You should try to guide the user to go deeper into the problem the user is trying to solve with the feature, and encourage them to articulate the "why" behind the feature, not just the "what". This will help you align your implementation with the underlying goals and motivations, leading to a more effective and impactful solution.
- Every time you're planning a new feature/implementation you should consult with the documents listed below to ensure your approach aligns with the overall product vision, architectural guidelines, target infrastructure. If implementation is touching any of the existing features - follow the relevant feature description file for detailed guidance on business logic and implementation notes. When you make any changes in the implementation or user asks to update the documentation you SHOULD update relevant documentation files to reflect the changes. The goal of the documents is to be a single source of truth for the project as of current state, but not to repeat knowledge that can be easily extraced from the source code. So you should focus on documenting the "why" and "what", and high level "how" (so reader and AI can get get a clear understanding).
- Project documentation files:
  - /specs/architecture.md - architecture of the solution and decisions behind it.
  - /specs/db.md - database schema, and comments and explanations for the schema design decisions, relationships, and any relevant details, and it should relate to the overall product features, business logic.
  - /specs/infra.md - how the application should be built during CI/CD process (and known CI/CD process itself), deployed, hosted, maintened, and monitored in production, and any relevant details about the infrastructure design decisions and trade-offs.
  - /specs/product.md - product vision, target audience, user personas, user needs, problems it sovles, and how the product addresses those needs and problems, and any relevant details about the product design decisions and trade-offs. It should give a hight level overview of the product and its functionality and flow without going into feature and implementation details (those should be in the feature files).
  - /specs/features/[NN-feature-summary] - specific feature documentation including what, why and how of the feature, and any relevant details about the feature design decisions and trade-offs. It should give a detailed overview of the feature, its functionality, user experience, business logic, and technical implementation notes. If the feature is related to an existing one - it should reference it and explain how they relate to each other. Use common sence on how to set boundries and to split functionality between feature files. (nameing example: if it's about chat summarisation, /specs/features/05-chat-summarisation.md)
  - /specs/features.md should act as an index of all features with a brief description and a link to the respective feature file. It should be updated every time a new feature is added or removed (feature file can be deleted if feature is deprecated). Its role is to give a quick overview of the features and their status, and to help navigate to the detailed documentation for each feature.
  - /specs/design.md - design, UX and UI decisions, conventions of the this project that should be followed across the product that should be respected when AI is implementing anything related to design, UX and UI.
- Make sure to maintain consistency in terminology, formatting, and level of detail across all documentation files for a cohesive and professional presentation.
- README files should be updated to reflect any changes in setup instructions, development workflow, or other relevant information for developers, but should not include detailed implementation or planning information. That should be reserved for the /specs/ files.

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
