#!/usr/bin/env bash
# Generates the master traceability matrix
mkdir -p docs/requirements

echo "Running Traceability Engine..."
./.tools/shtracer/shtracer .tools/.shtracer.md > docs/requirements/traceability_matrix.json

echo "Rendering Markdown Matrix..."
node scripts/render_matrix.js docs/requirements/traceability_matrix.json docs/requirements/traceability_matrix.md

echo "Cleaning up..."
rm docs/requirements/traceability_matrix.json

echo "Matrix generation complete"
echo "Matrix generation complete"
