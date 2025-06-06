import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface FileStructure {
  name: string;
  type: "file" | "directory";
  children?: FileStructure[];
  imports?: string[];
  exports?: string[];
  components?: string[];
}

interface ProjectAnalysis {
  timestamp: string;
  structure: FileStructure;
}

function analyzeTypeScriptFile(filePath: string): {
  imports: string[];
  exports: string[];
  components: string[];
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true
  );

  const imports: string[] = [];
  const exports: string[] = [];
  const components: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
      imports.push(importPath);
    }

    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        exports.push((node.moduleSpecifier as ts.StringLiteral).text);
      }
    }

    if (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) {
      const name = node.name?.getText(sourceFile);
      if (name && /^[A-Z]/.test(name)) {
        components.push(name);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { imports, exports, components };
}

function analyzeDirectory(dirPath: string): FileStructure {
  const name = path.basename(dirPath);
  const structure: FileStructure = {
    name,
    type: "directory",
    children: [],
  };

  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stats = fs.statSync(fullPath);

    if (
      stats.isDirectory() &&
      !entry.startsWith(".") &&
      entry !== "node_modules"
    ) {
      structure.children!.push(analyzeDirectory(fullPath));
    } else if (stats.isFile() && /\.(ts|tsx)$/.test(entry)) {
      const analysis = analyzeTypeScriptFile(fullPath);
      structure.children!.push({
        name: entry,
        type: "file",
        imports: analysis.imports,
        exports: analysis.exports,
        components: analysis.components,
      });
    }
  }

  return structure;
}

function printStructure(structure: FileStructure, level = 0): void {
  const indent = "  ".repeat(level);
  console.log(
    `${indent}${structure.type === "directory" ? "📁" : "📄"} ${structure.name}`
  );

  if (structure.type === "file") {
    if (structure.imports?.length) {
      console.log(`${indent}  Imports:`);
      structure.imports.forEach((imp) => console.log(`${indent}    - ${imp}`));
    }
    if (structure.exports?.length) {
      console.log(`${indent}  Exports:`);
      structure.exports.forEach((exp) => console.log(`${indent}    - ${exp}`));
    }
    if (structure.components?.length) {
      console.log(`${indent}  Components:`);
      structure.components.forEach((comp) =>
        console.log(`${indent}    - ${comp}`)
      );
    }
  }

  if (structure.children) {
    structure.children.forEach((child) => printStructure(child, level + 1));
  }
}

function saveStructureToFile(
  structure: FileStructure,
  outputPath: string
): void {
  const analysis: ProjectAnalysis = {
    timestamp: new Date().toISOString(),
    structure,
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), "utf-8");
  console.log(`\nProject structure has been saved to: ${outputPath}`);
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
const outputPath = path.join(outputDir, `project-structure-${timestamp}.json`);

// Analyze the project structure
console.log("Analyzing project structure...\n");
const projectStructure = analyzeDirectory(path.join(projectRoot, "src"));

// Print the results to console
console.log("Project Structure:");
printStructure(projectStructure);

// Save the structure to a file
saveStructureToFile(projectStructure, outputPath);
