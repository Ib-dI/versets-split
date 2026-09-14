#!/usr/bin/env node
// Régénère data/existing-timings.js depuis src/lib/data/audios.ts (tafsir-app,
// dépôt frère) — évite la copie manuelle qui a produit le snapshot actuel.
// Timings de versets uniquement (comme avant) : le mode mots de cet outil
// part toujours de zéro pour un verset donné, les mots déjà posés dans
// audios.ts n'ont rien à faire ici.
//
// Usage:
//   node sync-existing-timings.mjs                     # ../tafsir-app par défaut
//   node sync-existing-timings.mjs /chemin/vers/tafsir-app

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tafsirAppRoot = path.resolve(here, process.argv[2] || "../tafsir-app");
const audiosPath = path.join(tafsirAppRoot, "src", "lib", "data", "audios.ts");
const outPath = path.join(here, "data", "existing-timings.js");

function loadAudiosTafsir(source) {
    const js = source.replace(/^export /gm, "").replace(/:\s*number\[\]/g, "");
    // eslint-disable-next-line no-eval
    return eval(`(function(){ ${js}\n return { audiosTafsir }; })()`).audiosTafsir;
}

function main() {
    if (!fs.existsSync(audiosPath)) {
        console.error(`audios.ts introuvable : ${audiosPath}`);
        console.error("Passe le chemin du dépôt tafsir-app en argument si ce n'est pas un dossier frère.");
        process.exit(1);
    }

    const source = fs.readFileSync(audiosPath, "utf8");
    const audiosTafsir = loadAudiosTafsir(source);

    const lines = [];
    lines.push("// Généré depuis src/lib/data/audios.ts (tafsir-app) — timings de versets déjà posés.");
    lines.push("// Ne pas éditer à la main : relancer `node sync-existing-timings.mjs`.");
    lines.push("const EXISTING_TIMINGS = {");
    for (const chapter of audiosTafsir) {
        lines.push(`  ${chapter.id}: [`);
        for (const part of chapter.parts || []) {
            lines.push("    {");
            lines.push(`      id: ${JSON.stringify(part.id)},`);
            lines.push(`      title: ${JSON.stringify(part.title)},`);
            lines.push("      timings: [");
            for (const timing of part.timings || []) {
                lines.push(`        { id: ${timing.id}, startTime: ${timing.startTime}, endTime: ${timing.endTime} },`);
            }
            lines.push("      ],");
            lines.push("    },");
        }
        lines.push("  ],");
    }
    lines.push("};");
    lines.push("");

    fs.writeFileSync(outPath, lines.join("\n"), "utf8");

    const partCount = audiosTafsir.reduce((n, ch) => n + (ch.parts?.length ?? 0), 0);
    console.log(`${audiosTafsir.length} chapitres, ${partCount} parties écrites dans ${outPath}`);
}

main();
