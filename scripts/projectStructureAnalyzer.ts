import * as fs from "fs";
import * as path from "path";

type ConfigSource = "shadcn" | "vite" | "custom" | "system";

interface FileStructure {
  name: string;
  type: "file" | "directory";
  children?: FileStructure[];
  components?: string[];
  isPreConfigured?: boolean;
  configType?: string;
  source?: ConfigSource;
}

interface DirConfig {
  type: string;
  source: ConfigSource;
}

interface ConfigData {
  type: string;
  source: ConfigSource;
}

// Define common pre-configured files and their types
const preConfiguredFiles = new Map<string, ConfigData>([
  ["package.json", { type: "Project Configuration", source: "system" }],
  ["tsconfig.json", { type: "TypeScript Configuration", source: "system" }],
  ["tailwind.config.ts", { type: "Tailwind Configuration", source: "system" }],
  ["postcss.config.js", { type: "PostCSS Configuration", source: "system" }],
  ["vite.config.ts", { type: "Vite Configuration", source: "vite" }],
  ["eslint.config.js", { type: "ESLint Configuration", source: "system" }],
  [".gitignore", { type: "Git Configuration", source: "system" }],
  [
    "components.json",
    { type: "UI Components Configuration", source: "shadcn" },
  ],
  ["index.html", { type: "Vite Entry Point", source: "vite" }],
  [
    "tsconfig.app.json",
    { type: "TypeScript App Configuration", source: "system" },
  ],
  [
    "tsconfig.node.json",
    { type: "TypeScript Node Configuration", source: "system" },
  ],
]);

// Define pre-configured directories and their patterns
const preConfiguredDirs = new Map<string, ConfigData>([
  ["components/ui", { type: "shadcn UI Component Library", source: "shadcn" }],
  ["lib/utils", { type: "Utility Functions", source: "shadcn" }],
  ["hooks", { type: "React Hooks Library", source: "custom" }],
  ["public", { type: "Static Assets", source: "vite" }],
]);

function isPreConfiguredDirectory(dirPath: string): {
  isPreConfigured: boolean;
  configType?: string;
  source?: ConfigSource;
} {
  for (const [pattern, config] of preConfiguredDirs.entries()) {
    if (dirPath.includes(pattern)) {
      return {
        isPreConfigured: true,
        configType: config.type,
        source: config.source as ConfigSource,
      };
    }
  }
  return { isPreConfigured: false };
}

function isUIComponentFile(filePath: string): boolean {
  return (
    filePath.includes("components/ui/") &&
    (filePath.endsWith(".tsx") || filePath.endsWith(".ts"))
  );
}

function analyzeDirectory(
  dirPath: string,
  relativePath: string = ""
): FileStructure {
  const name = path.basename(dirPath);
  const structure: FileStructure = {
    name,
    type: "directory",
    children: [],
  };

  // Check if this is a pre-configured directory
  const dirConfig = isPreConfiguredDirectory(relativePath);
  if (dirConfig.isPreConfigured) {
    structure.isPreConfigured = true;
    structure.configType = dirConfig.configType;
    structure.source = dirConfig.source;
  }

  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const entryRelativePath = path.join(relativePath, entry);
    const stats = fs.statSync(fullPath);

    if (
      stats.isDirectory() &&
      !entry.startsWith(".") &&
      entry !== "node_modules"
    ) {
      structure.children!.push(analyzeDirectory(fullPath, entryRelativePath));
    } else if (stats.isFile()) {
      // Check if this is a pre-configured file
      const isPreConfiguredFile = preConfiguredFiles.has(entry);
      const isUIComponent = isUIComponentFile(entryRelativePath);
      const configData = preConfiguredFiles.get(entry);

      const fileStructure: FileStructure = {
        name: entry,
        type: "file",
        isPreConfigured: isPreConfiguredFile || isUIComponent,
        configType: isPreConfiguredFile
          ? configData?.type
          : isUIComponent
          ? "UI Component"
          : undefined,
        source: isPreConfiguredFile
          ? configData?.source
          : isUIComponent
          ? ("shadcn" as ConfigSource)
          : undefined,
      };
      structure.children!.push(fileStructure);
    }
  }

  return structure;
}

function printStructure(structure: FileStructure, level = 0): void {
  const indent = "  ".repeat(level);
  const icon = structure.type === "directory" ? "📁" : "📄";
  const preConfiguredBadge = structure.isPreConfigured
    ? " [⚙️ Pre-configured]"
    : "";
  const configType = structure.configType ? ` (${structure.configType})` : "";
  const source = structure.source ? ` [${structure.source}]` : "";

  console.log(
    `${indent}${icon} ${structure.name}${preConfiguredBadge}${configType}${source}`
  );

  if (structure.children) {
    structure.children.forEach((child) => printStructure(child, level + 1));
  }
}

function saveStructureToFile(
  structure: FileStructure,
  outputPath: string
): void {
  const analysis = {
    timestamp: new Date().toISOString(),
    structure,
    summary: {
      totalPreConfiguredFiles: countPreConfiguredFiles(structure),
      sourceBreakdown: getSourceBreakdown(structure),
    },
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), "utf-8");
  console.log(`\nProject structure has been saved to: ${outputPath}`);
}

function countPreConfiguredFiles(structure: FileStructure): number {
  let count = structure.isPreConfigured ? 1 : 0;
  if (structure.children) {
    count += structure.children.reduce(
      (acc, child) => acc + countPreConfiguredFiles(child),
      0
    );
  }
  return count;
}

function getSourceBreakdown(structure: FileStructure): Record<string, number> {
  const breakdown: Record<string, number> = {};

  function countSources(node: FileStructure) {
    if (node.source) {
      breakdown[node.source] = (breakdown[node.source] || 0) + 1;
    }
    node.children?.forEach(countSources);
  }

  countSources(structure);
  return breakdown;
}

// Get the project root directory
const projectRoot = process.cwd();

// Create output directory if it doesn't exist
const outputDir = path.join(projectRoot, "analysis");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate timestamp for the filename
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = path.join(
  outputDir,
  `project-structure-simple-${timestamp}.json`
);

// Analyze the project structure
console.log("Analyzing project structure...\n");
const projectStructure = analyzeDirectory(projectRoot);

// Print the results to console
console.log("Project Structure:");
printStructure(projectStructure);

// Save the structure to a file
saveStructureToFile(projectStructure, outputPath);
