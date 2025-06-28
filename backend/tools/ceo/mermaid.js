import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";


const mermaidToolSchema = z.object({
  mermaidSyntax: z.string().describe("The Mermaid diagram syntax"),
  filename: z.string().describe("Filename without extension (e.g., 'strategy-flow')"),
  title: z.string().optional().describe("Optional title for the diagram")
});


export const generateMermaidImageTool = tool(
  async ({ mermaidSyntax, filename, title }) => {
    try {
      // Create output directory
      const outputDir = "./generated-diagrams";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create temporary mermaid file
      const tempMmdFile = path.join(outputDir, `${filename}.mmd`);
      const outputPngFile = path.join(outputDir, `${filename}.png`);
      const outputSvgFile = path.join(outputDir, `${filename}.svg`);

      // Add title if provided
      const fullMermaidContent = title 
        ? `---\ntitle: ${title}\n---\n${mermaidSyntax}`
        : mermaidSyntax;

      // Write mermaid syntax to temp file
      fs.writeFileSync(tempMmdFile, fullMermaidContent);

      // Try to generate PNG using mermaid-cli
      try {
        execSync(`npx @mermaid-js/mermaid-cli -i ${tempMmdFile} -o ${outputPngFile}`, {
          timeout: 30000,
          stdio: 'pipe'
        });
      } catch (cliError) {
        // Fallback: create simple text-based representation
        const textRepresentation = `
MERMAID DIAGRAM: ${title || filename}
=====================================
${mermaidSyntax}
=====================================
Note: Visual rendering failed, but syntax is saved.
        `;
        
        const textFile = path.join(outputDir, `${filename}.txt`);
        fs.writeFileSync(textFile, textRepresentation);
        
        return {
          success: true,
          message: `Mermaid syntax saved successfully (visual rendering unavailable)`,
          files: {
            mermaid: tempMmdFile,
            text: textFile
          },
          note: "Install @mermaid-js/mermaid-cli globally for image generation: npm install -g @mermaid-js/mermaid-cli"
        };
      }

      // Try to generate SVG as well
      try {
        execSync(`npx @mermaid-js/mermaid-cli -i ${tempMmdFile} -o ${outputSvgFile}`, {
          timeout: 15000,
          stdio: 'pipe'
        });
      } catch (svgError) {
        // SVG generation failed, but PNG might have succeeded
      }

      // Clean up temp file
      if (fs.existsSync(tempMmdFile)) {
        fs.unlinkSync(tempMmdFile);
      }

      const generatedFiles = {
        mermaid: tempMmdFile
      };

      if (fs.existsSync(outputPngFile)) {
        generatedFiles.png = outputPngFile;
      }
      
      if (fs.existsSync(outputSvgFile)) {
        generatedFiles.svg = outputSvgFile;
      }

      return {
        success: true,
        message: `Mermaid flowchart generated successfully!`,
        files: generatedFiles,
        diagram: mermaidSyntax
      };

    } catch (error) {
      // Ultimate fallback - just save the syntax
      try {
        const outputDir = "./generated-diagrams";
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const fallbackFile = path.join(outputDir, `${filename}_mermaid_syntax.txt`);
        const fallbackContent = `
MERMAID DIAGRAM SYNTAX
======================
Title: ${title || filename}
Generated: ${new Date().toISOString()}

${mermaidSyntax}

======================
Copy this syntax to https://mermaid.live/ to view the diagram
        `;
        
        fs.writeFileSync(fallbackFile, fallbackContent);
        
        return {
          success: true,
          message: `Mermaid syntax saved as fallback file`,
          files: {
            syntax: fallbackFile
          },
          note: "Visit https://mermaid.live/ to visualize this diagram",
          diagram: mermaidSyntax
        };
      } catch (finalError) {
        return {
          success: false,
          message: `Tool failed completely: ${error.message}`,
          error: error.toString()
        };
      }
    }
  },
  {
    name: "mermaid_flowchart_generator",
    description: `Creates Mermaid flowchart diagrams. Simple and reliable tool that saves Mermaid syntax and attempts to generate images.

USAGE FOR AGENT:
- Use for visualizing processes, strategies, decision flows
- Pass valid Mermaid syntax
- Tool will attempt image generation but always preserves syntax

MERMAID SYNTAX EXAMPLES:

Basic Flowchart:
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]

Business Process:
flowchart LR
    A[Idea] --> B[Research] --> C[Build] --> D[Launch]

Strategy Flow:
flowchart TD
    A[Current State] --> B[Analysis]
    B --> C[Strategy]
    C --> D[Execute]
    D --> E[Measure]

Use proper Mermaid syntax with --> arrows and [brackets] for boxes, {braces} for diamonds.`,
    schema: mermaidToolSchema,
  }
);
