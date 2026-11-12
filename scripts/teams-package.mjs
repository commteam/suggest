/**
 * Microsoft Teams 앱 패키지(zip) 만들기
 *   npm run teams:package -- --host awards.example.com [--app-id <GUID>] [--developer "회사명"]
 * 결과: teams-app/build/suggestion-awards-teams.zip (manifest.json + color.png + outline.png)
 * 이 zip 을 Teams 관리 센터(조직 앱) 또는 Teams 클라이언트 "앱 업로드"로 올리면 개인 탭으로 쓸 수 있습니다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const host = (args.host ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
  console.error('사용법: npm run teams:package -- --host awards.example.com [--app-id GUID] [--developer "회사명"]');
  process.exit(1);
}
const appIdFile = 'teams-app/.app-id';
let appId = args['app-id'];
if (!appId && fs.existsSync(appIdFile)) appId = fs.readFileSync(appIdFile, 'utf8').trim();
if (!appId) {
  appId = crypto.randomUUID();
  fs.writeFileSync(appIdFile, appId + '\n'); // 같은 앱으로 업데이트되도록 재사용
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)) {
  console.error('--app-id 는 GUID 형식이어야 합니다.');
  process.exit(1);
}

const manifest = fs
  .readFileSync('teams-app/manifest.template.json', 'utf8')
  .replaceAll('{{HOST}}', host)
  .replaceAll('{{APP_ID}}', appId)
  .replaceAll('{{DEVELOPER_NAME}}', (args.developer ?? '사내 제안제도 운영팀').replace(/"/g, ''));
JSON.parse(manifest); // 형식 검사

// ---- 최소 ZIP 작성기 (deflate) ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name);
    const deflated = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 이름
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, deflated);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + deflated.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const outDir = 'teams-app/build';
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'suggestion-awards-teams.zip');
fs.writeFileSync(
  out,
  zip([
    { name: 'manifest.json', data: Buffer.from(manifest) },
    { name: 'color.png', data: fs.readFileSync('teams-app/color.png') },
    { name: 'outline.png', data: fs.readFileSync('teams-app/outline.png') },
  ]),
);
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifest);
console.log(`✓ ${out}`);
console.log(`  앱 ID: ${appId}`);
console.log(`  발표 탭: https://${host}/?source=teams`);
console.log(`  관리 탭: https://${host}/admin?source=teams`);
