#!/bin/bash
# MapGPU SonarQube Scanner
# Kullanım: SONAR_TOKEN=xxx ./scripts/sonar-scan.sh

set -e

if [ -z "$SONAR_TOKEN" ]; then
  echo "SONAR_TOKEN environment variable gerekli!"
  echo ""
  echo "Token oluşturmak için:"
  echo "  1. http://localhost:9000 adresine git"
  echo "  2. Administration > Security > Users > Tokens"
  echo "  3. 'Generate' ile yeni token oluştur"
  echo "  4. SONAR_TOKEN=<token> ./scripts/sonar-scan.sh"
  exit 1
fi

echo "=== Test + Coverage ==="
npx vitest run --coverage 2>/dev/null || true

echo ""
echo "=== SonarQube Scan ==="
npx sonar-scanner \
  -Dsonar.token="$SONAR_TOKEN" \
  -Dsonar.projectKey=mapgpu \
  -Dsonar.projectName=MapGPU \
  -Dsonar.host.url=http://localhost:9000

echo ""
echo "Sonuçlar: http://localhost:9000/dashboard?id=mapgpu"
