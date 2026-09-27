import fs from "node:fs";
import path from "node:path";

export interface DetectedStack {
  projectName: string;
  languages: string[];
  frameworks: string[];
  gitRoot?: string;
}

export function detectStack(targetDir: string = process.cwd()): DetectedStack {
  const languages: string[] = [];
  const frameworks: string[] = [];

  let projectName = path.basename(targetDir);

  // Check Git
  let gitRoot: string | undefined;
  if (fs.existsSync(path.join(targetDir, ".git"))) {
    gitRoot = targetDir;
  }

  // Node / TypeScript / JavaScript
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name) {
        projectName = pkg.name;
      }
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (fs.existsSync(path.join(targetDir, "tsconfig.json")) || allDeps.typescript) {
        languages.push("TypeScript");
      } else {
        languages.push("JavaScript");
      }

      if (allDeps.next) frameworks.push("Next.js");
      if (allDeps.react) frameworks.push("React");
      if (allDeps["@nestjs/core"]) frameworks.push("NestJS");
      if (allDeps.express) frameworks.push("Express");
      if (allDeps.vue) frameworks.push("Vue");
    } catch {
      languages.push("JavaScript");
    }
  }

  // Python
  if (
    fs.existsSync(path.join(targetDir, "requirements.txt")) ||
    fs.existsSync(path.join(targetDir, "pyproject.toml")) ||
    fs.existsSync(path.join(targetDir, "setup.py"))
  ) {
    languages.push("Python");
    if (fs.existsSync(path.join(targetDir, "requirements.txt"))) {
      try {
        const reqs = fs.readFileSync(path.join(targetDir, "requirements.txt"), "utf-8").toLowerCase();
        if (reqs.includes("fastapi")) frameworks.push("FastAPI");
        if (reqs.includes("django")) frameworks.push("Django");
        if (reqs.includes("flask")) frameworks.push("Flask");
      } catch {
        // ignore read error
      }
    }
  }

  // Go
  if (fs.existsSync(path.join(targetDir, "go.mod"))) {
    languages.push("Go");
  }

  // Rust
  if (fs.existsSync(path.join(targetDir, "Cargo.toml"))) {
    languages.push("Rust");
  }

  // C# / .NET
  try {
    const files = fs.readdirSync(targetDir);
    if (files.some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) {
      languages.push("C#");
      frameworks.push(".NET");
    }
    if (files.some((f) => f.endsWith(".pom") || f === "pom.xml" || f === "build.gradle")) {
      languages.push("Java");
    }
  } catch {
    // ignore
  }

  if (languages.length === 0) {
    languages.push("Generic");
  }

  return {
    projectName,
    languages: Array.from(new Set(languages)),
    frameworks: Array.from(new Set(frameworks)),
    gitRoot,
  };
}
