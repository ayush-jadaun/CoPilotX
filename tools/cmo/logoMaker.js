import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fetch from 'node-fetch';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Logo maker tool schema
const logoMakerSchema = z.object({
  prompt: z.string().describe("Detailed description of the logo design (e.g., 'Modern minimalist logo for tech startup, blue and white colors, geometric shapes')"),
  companyName: z.string().describe("Company name to include in the filename"),
  style: z.string().optional().describe("Logo style preference (e.g., 'minimalist', 'modern', 'vintage', 'corporate')"),
  colors: z.string().optional().describe("Color preferences (e.g., 'blue and white', 'monochrome', 'vibrant')"),
  outputDir: z.string().optional().describe("Output directory (defaults to './generated-logos')")
});

export const logoMakerTool = tool(
  async ({ prompt, companyName, style, colors, outputDir = "./generated-logos" }) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let enhancedPrompt = prompt;
      
      if (style || colors) {
        enhancedPrompt += " Logo design";
        if (style) enhancedPrompt += `, ${style} style`;
        if (colors) enhancedPrompt += `, ${colors} color scheme`;
        enhancedPrompt += ", professional quality, clean background, vector-style";
      }

      console.log(`🎨 Generating logo with prompt: "${enhancedPrompt}"`);

      // Call Together AI API
      const response = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: enhancedPrompt,
          width: 512,
          height: 512,
          steps: 4
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const json = await response.json();
      const imageUrl = json.data?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error("Image URL not found in API response");
      }

      // Download the image
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new Error(`Failed to download image: ${imageRes.status}`);
      }

      const originalBuffer = Buffer.from(await imageRes.arrayBuffer());

      // Generate filenames
      const sanitizedCompanyName = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const timestamp = new Date().toISOString().split('T')[0];
      const baseFilename = `${sanitizedCompanyName}-logo-${timestamp}`;

      // Save original
      const originalPath = path.join(outputDir, `${baseFilename}-original.png`);
      fs.writeFileSync(originalPath, originalBuffer);
      const generatedFiles = {
        original: originalPath
      };

      return {
        success: true,
        message: `Logo generated successfully for ${companyName}!`,
        company: companyName,
        prompt: enhancedPrompt,
        files: generatedFiles,
        totalFiles: Object.keys(generatedFiles).length,
        recommendation: "Use 'large' (256x256) for web headers, 'medium' (128x128) for social media, 'favicon' (32x32) for browser tabs"
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to generate logo: ${error.message}`,
        error: error.toString(),
        troubleshooting: {
          apiKey: process.env.TOGETHER_API_KEY ? "✓ API key found" : "✗ TOGETHER_API_KEY not set",
          suggestion: "Check your Together AI API key and internet connection"
        }
      };
    }
  },
  {
    name: "logo_maker",
    description: `Generates professional logos using AI image generation. Creates multiple sizes and formats suitable for different use cases.

USAGE FOR AGENT:
- Use when asked to create, design, or generate logos
- Use for brand identity, company logos, startup branding
- Pass detailed descriptions for better results

PARAMETERS:
- prompt: Detailed logo description (be specific about style, elements, mood)
- companyName: Company name (used for filename)
- style: Optional style preference (minimalist, modern, vintage, corporate, playful)
- colors: Optional color scheme (blue and white, monochrome, vibrant, corporate colors)

PROMPT EXAMPLES:
✓ Good: "Modern minimalist logo for tech startup, geometric shapes, blue gradient, clean lines, professional"
✓ Good: "Vintage coffee shop logo, warm brown colors, coffee bean illustration, rustic typography"
✓ Good: "Corporate consulting firm logo, navy blue and gold, abstract symbol, professional serif font"

✗ Avoid: "Make a logo" (too vague)
✗ Avoid: "Logo with text" (specify the text and style)

OUTPUTS:
- Multiple sizes: favicon (32px), small (64px), medium (128px), large (256px), XL (512px)
- Original high-resolution version
- Square version with padding
- All in PNG format with transparency support

The tool automatically creates professional logos optimized for web, print, and social media use.`,
    schema: logoMakerSchema,
  }
);
