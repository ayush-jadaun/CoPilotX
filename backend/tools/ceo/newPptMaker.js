import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import PptxGenJS from "pptxgenjs";
import fs from "fs/promises";
import path from "path";

// Schema for the PowerPoint maker tool input
const PPTMakerSchema = z.object({
  title: z.string().describe("Main title of the presentation"),
  slides: z
    .array(
      z.object({
        type: z
          .enum([
            "title",
            "content",
            "image",
            "chart",
            "comparison",
            "timeline",
            "conclusion",
          ])
          .describe("Type of slide to create"),
        title: z.string().describe("Slide title"),
        content: z
          .union([
            z.string(),
            z.array(z.string()),
            z.object({
              text: z.string().optional(),
              bullets: z.array(z.string()).optional(),
              leftColumn: z.array(z.string()).optional(),
              rightColumn: z.array(z.string()).optional(),
              chartData: z
                .array(
                  z.object({
                    name: z.string(),
                    labels: z.array(z.string()),
                    values: z.array(z.number()),
                  })
                )
                .optional(),
              timelineItems: z
                .array(
                  z.object({
                    date: z.string(),
                    event: z.string(),
                    description: z.string().optional(),
                  })
                )
                .optional(),
            }),
          ])
          .describe(
            "Slide content - can be string, array of strings, or structured object"
          ),
        notes: z.string().optional().describe("Speaker notes for the slide"),
      })
    )
    .describe("Array of slides to create"),
  theme: z
    .enum(["corporate", "modern", "creative", "minimal", "startup"])
    .default("corporate")
    .describe("Presentation theme"),
  outputPath: z
    .string()
    .optional()
    .describe("Output file path (defaults to ./presentations/)"),
  fileName: z.string().optional().describe("File name without extension"),
});

class PPTMakerTool extends Tool {
  name = "ppt_maker";
  description = "Creates professional PowerPoint presentations. [Real Implementation v1.0]";
  schema = PPTMakerSchema;

  constructor() {
    super();
  }

  // Theme configurations
  getThemeConfig(theme) {
    const themes = {
      corporate: {
        background: "#FFFFFF",
        primary: "#1F4E79",
        secondary: "#5B9BD5",
        accent: "#70AD47",
        text: "#404040",
        font: "Calibri",
      },
      modern: {
        background: "#F8F9FA",
        primary: "#2C3E50",
        secondary: "#3498DB",
        accent: "#E74C3C",
        text: "#2C3E50",
        font: "Segoe UI",
      },
      creative: {
        background: "#FFFFFF",
        primary: "#8E44AD",
        secondary: "#E67E22",
        accent: "#F39C12",
        text: "#2C3E50",
        font: "Century Gothic",
      },
      minimal: {
        background: "#FFFFFF",
        primary: "#000000",
        secondary: "#666666",
        accent: "#999999",
        text: "#333333",
        font: "Arial",
      },
      startup: {
        background: "#FFFFFF",
        primary: "#FF6B6B",
        secondary: "#4ECDC4",
        accent: "#45B7D1",
        text: "#2C3E50",
        font: "Montserrat",
      },
    };
    return themes[theme] || themes.corporate;
  }

  async _call(input) {
    console.log("[PptMakerTool] Real Implementation v1.0 invoked with input:", JSON.stringify(input, null, 2));
    try {
      const { title, slides, theme, outputPath, fileName } = input;

      // Initialize PowerPoint generator
      const pptx = new PptxGenJS();
      const themeConfig = this.getThemeConfig(theme);

      // Set presentation properties
      pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
      pptx.layout = "LAYOUT_16x9";

      // Add title slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { fill: themeConfig.background };

      titleSlide.addText(title, {
        x: 1,
        y: 2,
        w: 8,
        h: 1.5,
        fontSize: 44,
        fontFace: themeConfig.font,
        color: themeConfig.primary,
        bold: true,
        align: "center",
      });

      // Add subtitle
      titleSlide.addText("Generated by AI Agent", {
        x: 1,
        y: 3.5,
        w: 8,
        h: 0.5,
        fontSize: 18,
        fontFace: themeConfig.font,
        color: themeConfig.secondary,
        align: "center",
      });

      // Process each slide
      for (const slideData of slides) {
        const slide = pptx.addSlide();
        slide.background = { fill: themeConfig.background };

        // Add slide title
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.8,
          fontSize: 32,
          fontFace: themeConfig.font,
          color: themeConfig.primary,
          bold: true,
        });

        // Add content based on slide type
        await this.addSlideContent(slide, slideData, themeConfig);

        // Add speaker notes if provided
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      }

      // Ensure output directory exists
      // Always save to ./sandbox
      const outputDir = path.resolve("./sandbox");
      await fs.mkdir(outputDir, { recursive: true });
      // Generate filename as before
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const finalFileName = fileName || `presentation_${timestamp}`;
      const fullPath = path.join(outputDir, `${finalFileName}.pptx`);
      await pptx.writeFile({ fileName: fullPath });
      return {
        success: true,
        filePath: fullPath,
        slideCount: slides.length + 1, // +1 for title slide
        message: `PowerPoint presentation created successfully: ${fullPath}`,
      };
    } catch (error) {
      console.error("PPT Maker Tool Error:", error);
      return {
        success: false,
        error: error.message,
        message: "Failed to create PowerPoint presentation",
      };
    }
  }

  async addSlideContent(slide, slideData, themeConfig) {
    const { type, content } = slideData;

    switch (type) {
      case "content":
        await this.addContentSlide(slide, content, themeConfig);
        break;
      case "comparison":
        await this.addComparisonSlide(slide, content, themeConfig);
        break;
      case "chart":
        await this.addChartSlide(slide, content, themeConfig);
        break;
      case "timeline":
        await this.addTimelineSlide(slide, content, themeConfig);
        break;
      case "conclusion":
        await this.addConclusionSlide(slide, content, themeConfig);
        break;
      default:
        await this.addContentSlide(slide, content, themeConfig);
    }
  }

  async addContentSlide(slide, content, themeConfig) {
    if (typeof content === "string") {
      // Simple text content
      slide.addText(content, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 3.5,
        fontSize: 18,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });
    } else if (Array.isArray(content)) {
      // Bullet points as array
      const bulletText = content.map((item) => `• ${item}`).join("\n");
      slide.addText(bulletText, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 3.5,
        fontSize: 16,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });
    } else if (typeof content === "object" && content && content.bullets) {
      // Structured bullet points
      const bulletText = content.bullets.map((item) => `• ${item}`).join("\n");
      slide.addText(bulletText, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 3.5,
        fontSize: 16,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });
    } else {
      // Fallback for invalid content
      console.warn("Invalid content format for content slide:", content);
      slide.addText("No content provided", {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 3.5,
        fontSize: 16,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });
    }
  }

  async addComparisonSlide(slide, content, themeConfig) {
    if (content.leftColumn && content.rightColumn) {
      // Left column
      const leftText = content.leftColumn.map((item) => `• ${item}`).join("\n");
      slide.addText(leftText, {
        x: 0.5,
        y: 1.5,
        w: 4,
        h: 3.5,
        fontSize: 14,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });

      // Right column
      const rightText = content.rightColumn
        .map((item) => `• ${item}`)
        .join("\n");
      slide.addText(rightText, {
        x: 5.5,
        y: 1.5,
        w: 4,
        h: 3.5,
        fontSize: 14,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        valign: "top",
      });

      // Divider line
      slide.addShape("line", {
        x: 4.75,
        y: 1.5,
        w: 0,
        h: 3.5,
        line: { color: themeConfig.secondary, width: 2 },
      });
    }
  }

  async addChartSlide(slide, content, themeConfig) {
    if (content.chartData && content.chartData.length > 0) {
      const chartData = content.chartData[0]; // Use first chart data

      slide.addChart(
        "bar",
        chartData.values.map((val, idx) => ({
          name: chartData.labels[idx] || `Item ${idx + 1}`,
          values: [val],
        })),
        {
          x: 1,
          y: 1.5,
          w: 8,
          h: 3.5,
          chartColors: [
            themeConfig.primary,
            themeConfig.secondary,
            themeConfig.accent,
          ],
          showTitle: false,
          showLegend: true,
        }
      );
    }
  }

  async addTimelineSlide(slide, content, themeConfig) {
    if (content.timelineItems) {
      let yPos = 1.5;
      content.timelineItems.forEach((item, idx) => {
        // Date
        slide.addText(item.date, {
          x: 0.5,
          y: yPos,
          w: 2,
          h: 0.4,
          fontSize: 14,
          fontFace: themeConfig.font,
          color: themeConfig.primary,
          bold: true,
        });

        // Event
        slide.addText(item.event, {
          x: 3,
          y: yPos,
          w: 6,
          h: 0.4,
          fontSize: 14,
          fontFace: themeConfig.font,
          color: themeConfig.text,
          bold: true,
        });

        // Description
        if (item.description) {
          slide.addText(item.description, {
            x: 3,
            y: yPos + 0.3,
            w: 6,
            h: 0.3,
            fontSize: 12,
            fontFace: themeConfig.font,
            color: themeConfig.secondary,
          });
        }

        yPos += 0.8;
      });
    }
  }

  async addConclusionSlide(slide, content, themeConfig) {
    if (typeof content === "string") {
      slide.addText(content, {
        x: 1,
        y: 2,
        w: 8,
        h: 2,
        fontSize: 24,
        fontFace: themeConfig.font,
        color: themeConfig.primary,
        bold: true,
        align: "center",
        valign: "middle",
      });
    } else if (content.bullets) {
      const bulletText = content.bullets.map((item) => `• ${item}`).join("\n");
      slide.addText(bulletText, {
        x: 1,
        y: 1.5,
        w: 8,
        h: 3,
        fontSize: 18,
        fontFace: themeConfig.font,
        color: themeConfig.text,
        align: "center",
      });
    }
  }
}

// Export the tool
export const pptMakerTool = new PPTMakerTool();

// Example usage function for your CEO Agent
export function createPresentationTool() {
  return pptMakerTool;
}

// Helper function to create a startup pitch deck
export function createStartupPitchDeck(
  companyName,
  problem,
  solution,
  market,
  businessModel
) {
  return {
    title: `${companyName} - Startup Pitch Deck`,
    theme: "startup",
    slides: [
      {
        type: "content",
        title: "The Problem",
        content: [
          problem,
          "Current solutions are inadequate",
          "Large addressable market opportunity",
        ],
      },
      {
        type: "content",
        title: "Our Solution",
        content: [
          solution,
          "Unique value proposition",
          "Scalable technology platform",
        ],
      },
      {
        type: "content",
        title: "Market Opportunity",
        content: [
          `Total Addressable Market: ${market}`,
          "Growing market demand",
          "First-mover advantage",
        ],
      },
      {
        type: "content",
        title: "Business Model",
        content: [
          businessModel,
          "Multiple revenue streams",
          "Recurring revenue model",
        ],
      },
      {
        type: "conclusion",
        title: "Next Steps",
        content: {
          bullets: [
            "Seeking $X investment",
            "Scale team and operations",
            "Accelerate market penetration",
          ],
        },
      },
    ],
  };
}

// Integration example for your CEO Agent
export function integratePPTToolWithCEOAgent(tools) {
  return [...tools, pptMakerTool];
}
