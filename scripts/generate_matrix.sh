#!/bin/bash
cd "$(dirname "$0")/.."
./.tools/shtracer/shtracer .tools/.shtracer.md --markdown > docs/requirements/traceability_matrix.md
echo "Matrix generation complete"
