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

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'KnowledgeHub-Publisher'
      },
      body: fileData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${name}: ${response.statusText}`);
    }

    const asset = await response.json();
    console.log(`Uploaded ${name}: ${asset.browser_download_url}`);
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

    // Upload .exe, .zip, .7z files, and other .yml files
    if (stat.isFile() && (
      file.endsWith('.zip') ||
      file.endsWith('.7z') ||
      file.endsWith('.exe') ||
      (file.endsWith('.yml') && file !== 'latest.yml') // Don't duplicate latest.yml
    )) {
      assetsToUpload.push({ path: filePath, name: file });
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
    await uploadAsset(release, asset.path, asset.name);
  }

  if (latestYmlFound) {
    console.log('\n✓ latest.yml uploaded successfully - auto-updates should work!');
  }

  console.log('Publishing complete!');
  console.log(`Release URL: ${release.html_url}`);
}

main().catch(console.error);
