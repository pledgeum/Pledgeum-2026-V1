
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log("--- Audit Report for src/app/page.tsx ---");

    // 1. Search for Definition
    const defIndex = lines.findIndex(line => line.includes('const [isTutorModalOpen'));
    if (defIndex === -1) {
        console.error("❌ ERROR: Definition 'const [isTutorModalOpen' NOT FOUND.");
    } else {
        console.log(`✅ Definition found at line ${defIndex + 1}:`);
        console.log(`   ${lines[defIndex].trim()}`);
    }

    // 2. Search for Home function start
    const homeIndex = lines.findIndex(line => line.includes('export default function Home'));
    if (homeIndex === -1) {
        console.error("❌ ERROR: 'export default function Home' NOT FOUND.");
    } else {
        console.log(`ℹ️ Home component starts at line ${homeIndex + 1}`);
    }

    // 3. Check Scope
    if (defIndex !== -1 && homeIndex !== -1) {
        if (defIndex > homeIndex) {
            console.log("✅ Scope Check: Valid (Definition is inside Home function)");
        } else {
            console.error("❌ CRITICAL: Definition is BEFORE Home function start (Global Scope error?)");
        }
    }

    // 4. Context Extraction
    if (homeIndex !== -1) {
        console.log("\n--- First 50 lines of Home Component ---");
        // Show next 50 lines after homeIndex (or less if file ends)
        const endContext = Math.min(lines.length, homeIndex + 50);
        for (let i = homeIndex; i < endContext; i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    }

    // 5. Usage Context (around line 1930 or where usage is found)
    console.log("\n--- Usage Context ---");
    const usageIndex = lines.findIndex(line => line.includes('isOpen={isTutorModalOpen}'));
    if (usageIndex === -1) {
        console.warn("⚠️ Usage 'isOpen={isTutorModalOpen}' not found via exact match.");
        // Try loose match
        lines.forEach((line, idx) => {
            if (line.includes('isTutorModalOpen') && idx !== defIndex) {
                console.log(`Usage found at line ${idx + 1}: ${line.trim()}`);
            }
        });
    } else {
        console.log(`Primary usage found at line ${usageIndex + 1}`);
        const startCtx = Math.max(0, usageIndex - 10);
        const endCtx = Math.min(lines.length, usageIndex + 10);
        for (let i = startCtx; i < endCtx; i++) {
            const prefix = (i === usageIndex) ? ">>> " : "    ";
            console.log(`${prefix}${i + 1}: ${lines[i]}`);
        }
    }

} catch (err) {
    console.error("Failed to read file:", err);
}
