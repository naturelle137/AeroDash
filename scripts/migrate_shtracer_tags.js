const fs = require('fs');
const path = require('path');

console.log("Migrating Traceability Tags for shtracer...");

// 1. Process safety_hazards.md
const hazardsPath = path.join(__dirname, '../docs/risk_management/safety_hazards.md');
let hazardsContent = fs.readFileSync(hazardsPath, 'utf8');
const hazardToReqMap = {};

// Clean up any existing tags to avoid duplication on re-runs
hazardsContent = hazardsContent.replace(/<!-- @H-\d{3}@ -->\n/g, '');

hazardsContent = hazardsContent.replace(/\| \*\*<a name="(H-\d{3})"><\/a>\1\*\* \|.*?\|.*?\| (.*?) \|.*?\|/g, (match, hId, reqsStr) => {
    const reqs = [...reqsStr.matchAll(/(REQ-[A-Z]+-\d{3})/g)].map(m => m[1]);
    reqs.forEach(req => {
        if (!hazardToReqMap[req]) hazardToReqMap[req] = [];
        hazardToReqMap[req].push(hId);
    });
    return `<!-- @${hId}@ -->\n${match}`;
});
fs.writeFileSync(hazardsPath, hazardsContent);
console.log("- Hazards processed.");

// 2. Process requirements
const reqDir = path.join(__dirname, '../docs/requirements');
const reqFiles = fs.readdirSync(reqDir).filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'traceability_matrix.md');

reqFiles.forEach(file => {
    const filePath = path.join(reqDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Clean up existing
    content = content.replace(/<!-- @REQ-[A-Z]+-\d{3}@.*?-->\n/g, '');

    content = content.replace(/\| \*\*<a name="(REQ-[A-Z]+-\d{3})"><\/a>\1\*\* \|/g, (match, reqId) => {
        const upstreams = hazardToReqMap[reqId] || [];
        const fromStr = upstreams.length > 0 ? ` (FROM: ${upstreams.map(h => `@${h}@`).join(', ')})` : '';
        return `<!-- @${reqId}@${fromStr} -->\n${match}`;
    });
    fs.writeFileSync(filePath, content);
});
console.log("- Requirements processed.");

// 3. Process Stress Tests
const stressPath = path.join(__dirname, '../docs/journeys/08_stress_tests.md');
if (fs.existsSync(stressPath)) {
    let stressContent = fs.readFileSync(stressPath, 'utf8');

    // Clean up existing
    stressContent = stressContent.replace(/<!-- @UJ-STRESS-\d{3}@.*?-->\n/g, '');

    stressContent = stressContent.replace(/### (UJ-STRESS-\d{3}):.*?\n\* \*\*Hazard Traced:\*\* \[(H-\d{3})\]/g, (match, ujId, hId) => {
        // Technically UJ shouldn't be direct child of H, but let's just use it to make standard tracing work. 
        return `<!-- @${ujId}@ (FROM: @${hId}@) -->\n${match}`;
    });
    fs.writeFileSync(stressPath, stressContent);
}
console.log("- Stress Tests processed.");

console.log("Migration Script Completed Successfully.");
