#!/bin/bash
# @description Deploy the application to a target environment
# @param ENV required "Target environment (staging|production)"
# @param VERSION default:latest "Docker image version to deploy"
# @param DRY_RUN default:false "Set to 'true' to skip actual deployment"

echo "=== Deploy Script ==="
echo "Environment: $ENV"
echo "Version:     $VERSION"
echo "Dry run:     $DRY_RUN"
echo ""

if [ "$DRY_RUN" = "true" ]; then
  echo "[DRY RUN] Would deploy $VERSION to $ENV — skipping."
else
  echo "Deploying $VERSION to $ENV..."
  sleep 1
  echo "Health check..."
  sleep 1
  echo "Done! Deployment complete."
fi
