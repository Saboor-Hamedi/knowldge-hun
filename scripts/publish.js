const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const owner = 'Saboor-Hamedi';
const repo = 'knowledge-hub';
const version = require('../package.json').version;
const token = process.env.GH_TOKEN;

if (!token) {
  console.error('GH_TOKEN environment variable is not set');
  process.exit(1);
}

async function createRelease() {
  try {
    // Check if release already exists
    const checkResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version}`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KnowledgeHub-Publisher'
      }
    });

    if (checkResponse.ok) {
      console.log(`Release v${version} already exists`);
      return checkResponse.json();
    }

    // Create new release
    const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'KnowledgeHub-Publisher'
      },
      body: JSON.stringify({
        tag_name: `v${version}`,
        name: `v${version}`,
        body: `Knowledge Hub v${version} - A powerful note-taking application with advanced features including hashtag highlighting, wikilinks, and content analysis.`,
        draft: false,
        prerelease: false
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create release: ${createResponse.statusText}`);
    }

    const release = await createResponse.json();
    console.log(`Created release: ${release.html_url}`);
    return release;

  } catch (error) {
    console.error('Error creating release:', error);
    process.exit(1);
  }
}

async function uploadAsset(release, filePath, name) {
  try {
    const fileData = fs.readFileSync(filePath);
    const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${name}`);

    // If an asset with the same name already exists on the release, delete it first
    try {
      const existingAssets = release.assets || [];
      const existing = existingAssets.find(a => a.name === name);
      if (existing) {
        const deleteUrl = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existing.id}`;
        const delRes = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'KnowledgeHub-Publisher'
          }
        });
        if (delRes.ok) {
          console.log(`Removed existing asset ${name} (id=${existing.id}) before upload`);
        } else {
          console.warn(`Failed to remove existing asset ${name} (id=${existing.id}): ${delRes.status} ${delRes.statusText}`);
        }
        // Refresh release assets list
        const refreshed = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'KnowledgeHub-Publisher'
          }
        });
        if (refreshed.ok) {
          const refreshedJson = await refreshed.json();
          release.assets = refreshedJson.assets || [];
        }
      }
    } catch (e) {
      console.warn('Warning: error while checking/deleting existing assets:', e);
    }

    // Stream upload with progress reporting
    const stat = fs.statSync(filePath);
    const progress = require('progress-stream');
    const ps = progress({ length: stat.size, time: 200 });
    ps.on('progress', p => {
      const pct = Math.round(p.percentage);
      process.stdout.write(`\rUploading ${name}: ${pct}% (${Math.round(p.transferred/1024)}KB/${Math.round(p.length/1024)}KB)`);
      if (pct >= 100) process.stdout.write('\n');
    });

    const readStream = fs.createReadStream(filePath).pipe(ps);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'KnowledgeHub-Publisher'
      },
      body: readStream
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${name}: ${response.status} ${response.statusText}`);
    }

    const asset = await response.json();
    console.log(`Uploaded ${name}: ${asset.browser_download_url}`);

    // Verify the uploaded asset is reachable
    try {
      const head = await fetch(asset.browser_download_url, { method: 'HEAD' });
      if (!head.ok) {
        console.warn(`Warning: uploaded asset ${name} returned ${head.status} on HEAD check`);
      }
    } catch (e) {
      console.warn('Warning: could not verify uploaded asset via HEAD', e.message || e);
    }

    return asset;

  } catch (error) {
    console.error(`Error uploading ${name}:`, error);
  }
}

async function createZip(sourceDir, zipPath) {
  const archiver = require('archiver');
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Created zip: ${zipPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, 'KnowledgeHub');
    archive.finalize();
  });
}

async function main() {
  console.log('Starting manual GitHub publishing...');

  // Create release
  const release = await createRelease();

  // Create zip of the portable app
  const distDir = path.join(__dirname, '..', 'dist');
  const zipPath = path.join(distDir, `knowledgehub-${version}-windows.zip`);

  if (fs.existsSync(path.join(distDir, 'win-unpacked'))) {
    console.log('Creating zip archive of portable app...');
    await createZip(path.join(distDir, 'win-unpacked'), zipPath);
  }

  // Find and upload assets
  const files = fs.readdirSync(distDir);
  const assetsToUpload = [];
  let latestYmlFound = false;

  // First, look for latest.yml specifically (critical for auto-updates)
  const latestYmlPath = path.join(distDir, 'latest.yml');
  if (fs.existsSync(latestYmlPath)) {
    assetsToUpload.push({ path: latestYmlPath, name: 'latest.yml' });
    latestYmlFound = true;
    console.log('✓ Found latest.yml - this is required for auto-updates');
  } else {
    console.warn('⚠ WARNING: latest.yml not found in dist folder!');
    console.warn('  Auto-updates will not work without this file.');
    console.warn('  Make sure electron-builder generated it during the build.');
  }

  // Look for other files
  for (const file of files) {
    const filePath = path.join(distDir, file);
    const stat = fs.statSync(filePath);

    // Upload .exe, .7z files, and other .yml files (skip .zip to save time)
    if (stat.isFile() && (
      /* skip .zip uploads because they are large and slow to upload */
      file.endsWith('.7z') ||
      file.endsWith('.exe') ||
      (file.endsWith('.yml') && file !== 'latest.yml') // Don't duplicate latest.yml
    )) {
      // Normalize upload name: replace spaces with hyphens to match electron-builder's urls
      // This prevents mismatches between `latest.yml` entries and GitHub asset names
      const normalizedName = file.replace(/\s+/g, '-');
      assetsToUpload.push({ path: filePath, name: normalizedName, originalName: file });
    }
  }

  console.log(`\nFound ${assetsToUpload.length} assets to upload:`);
  assetsToUpload.forEach(asset => console.log(`  - ${asset.name}`));

  if (!latestYmlFound && assetsToUpload.length > 0) {
    console.warn('\n⚠ WARNING: Publishing without latest.yml!');
    console.warn('  Users will not be able to auto-update.');
    console.warn('  Consider running: npm run build:win first to generate latest.yml');
  }

  // Upload assets - prioritize latest.yml first
  const sortedAssets = assetsToUpload.sort((a, b) => {
    if (a.name === 'latest.yml') return -1;
    if (b.name === 'latest.yml') return 1;
    return 0;
  });

  for (const asset of sortedAssets) {
    // If we normalized the name, upload using the normalized name so URLs match latest.yml
    const uploadName = asset.name || path.basename(asset.path);
    await uploadAsset(release, asset.path, uploadName);
  }

  if (latestYmlFound) {
    console.log('\n✓ latest.yml uploaded successfully - auto-updates should work!');
  }

  console.log('Publishing complete!');
  console.log(`Release URL: ${release.html_url}`);
}

main().catch(console.error);
