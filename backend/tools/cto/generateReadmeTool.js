import { Tool } from "langchain/tools";

/**
 * Tool: generate_readme
 * Usage: Generate a markdown README file for a project
 * Input: JSON string with `projectName` and `description`
 */
export const generateReadmeTool = new Tool({
  name: "generate_readme",
  description:
    "Generate a professional README.md from a project name and short description. Input should be a JSON string like: { projectName, description }",

  func: async (input) => {
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new Error("Invalid input. Expected JSON string.");
    }

    const { projectName, description } = parsed;
    if (!projectName || !description) {
      throw new Error("Missing projectName or description.");
    }

    return `# ${projectName}

${description}

## Features

- Feature 1
- Feature 2
- Feature 3

## Getting Started

1. Clone the repo
2. Install dependencies
3. Run the app

\`\`\`bash
git clone https://github.com/youruser/${projectName.toLowerCase().replace(/\s+/g, "-")}
cd ${projectName.toLowerCase().replace(/\s+/g, "-")}
npm install
npm run dev
\`\`\`

## License

MIT © YourName
`;
  },
});
