#!/usr/bin/env bash
# Generates the master traceability matrix
mkdir -p reports

echo "Running Traceability Engine..."
./.tools/shtracer/shtracer .tools/.shtracer.md > reports/traceability_matrix.json

echo "Rendering HTML Matrix..."
node scripts/render_matrix.js reports/traceability_matrix.json reports/traceability_matrix.html

echo "Matrix generation complete"
echo "Outputs stored in reports/traceability_matrix.html and json"
