const [major, minor] = process.versions.node.split('.').map(Number);

if (!((major === 22 && minor >= 13) || major >= 24)) {
  console.error(`Node.js ${process.versions.node} belum didukung frontend ini.`);
  console.error('Gunakan Node 22.13+ (seri 22) atau Node 24+.');
  console.error('Dari root project: nvm install 22 && nvm use 22');
  process.exitCode = 1;
}
