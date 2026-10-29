import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const SUPPORTED_PVZ_PROFILE = {
  id: 'goty-hd-local-test',
  executable: {
    file: 'PlantsVsZombies.exe',
    bytes: 3_703_808,
    sha256: '05a3f55a3889b1820bca844b26bb6bea1a058522ba842711e1c7d2000efad8d0',
  },
  assets: {
    file: 'main.pak',
    bytes: 60_371_863,
    sha256: '71b0cd561252d1bcbcbe1b7b2e157791b5843fb8cd94ca42945048c269c3bf17',
  },
} as const;

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifyFile(
  path: string,
  expected: { bytes: number; sha256: string },
  label: string,
): Promise<void> {
  const info = await stat(path).catch(() => null);
  if (!info) throw new Error(`找不到 ${label}: ${path}`);
  if (!info.isFile()) throw new Error(`${label}必须是文件: ${path}`);
  if (info.size !== expected.bytes) {
    throw new Error(`${label}大小不匹配: ${path} (${info.size} != ${expected.bytes})`);
  }
  const hash = await sha256File(path);
  if (hash !== expected.sha256) throw new Error(`${label} SHA-256 不匹配: ${path}`);
}

/** Injection is allowed only after both executable and asset fingerprints match. */
export async function verifyPvzInstallation(executablePath: string): Promise<void> {
  await verifyFile(executablePath, SUPPORTED_PVZ_PROFILE.executable, 'PvZ 游戏程序');
  await verifyFile(
    join(dirname(executablePath), SUPPORTED_PVZ_PROFILE.assets.file),
    SUPPORTED_PVZ_PROFILE.assets,
    'PvZ 资源文件 main.pak',
  );
}
