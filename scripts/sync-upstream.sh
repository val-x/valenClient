#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuring git to use rebase when pulling...${NC}"
git config pull.rebase true

echo -e "${YELLOW}Fetching from upstream...${NC}"
git fetch upstream

echo -e "${YELLOW}Checking out main branch...${NC}"
git checkout main

echo -e "${YELLOW}Rebasing with upstream/main...${NC}"
git rebase upstream/main

echo -e "${YELLOW}Force pushing to origin...${NC}"
git push origin main --force

echo -e "${GREEN}✓ Successfully synced with upstream and pushed to fork${NC}" 