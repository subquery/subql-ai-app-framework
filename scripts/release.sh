#!/bin/sh
set -e

version="$1"

if [ -z "$version" ]; then
    echo "Version must be provided"
    exit 1
fi

deno run -A npm:@geut/chan release "$version" --git-url \"https://github.com/subquery/subql-ai-app-framework\"

# Add updated files
git add -u

# Make commit
git commit -m "Release ${version}"

# Get release info for tag message
tag_msg="$(deno run -A npm:@geut/chan show $version)"

# Create tag
git tag -a "v${version}" -m "$tag_msg"

# Push the commit and the tag
git push origin && git push origin "v${version}"

