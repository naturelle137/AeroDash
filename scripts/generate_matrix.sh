#!/usr/bin/env bash
# Generates the master traceability matrix
# To use on windows in Powershell: "& "C:\Program Files\Git\bin\bash.exe" scripts/generate_matrix.sh"
mkdir -p reports

echo "Running Traceability Engine..."
./.tools/shtracer/shtracer .tools/.shtracer.md > reports/traceability_matrix.json

echo "Rendering HTML Matrix..."
./.tools/shtracer/shtracer --html .tools/.shtracer.md > reports/traceability_matrix.html

echo "Matrix generation complete"
echo "Outputs stored in reports/traceability_matrix.html and json"
