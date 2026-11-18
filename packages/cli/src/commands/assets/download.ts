import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import { getAsset, formatAssetReference } from '@threeify/sdk';
import { writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { getMedia, getMediaOriginalUrl, startMediaTask, waitForTaskCompletion } from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

function getDownloadFilename(assetName: string, extension: string): string {
  return `${assetName}${extension.startsWith('.') ? '' : '.'}${extension}`;
}

export const command = defineCommand({
  command: 'download [assetReference]',
  describe: 'Download asset file',
  builder: (yargs) =>
    withAssetInput(yargs, { version: 'read' }).options({
      format: {
        type: 'string',
        choices: ['glb', 'usdz', 'blend', 'fcstd', 'iges', 'step'] as const,
        description: 'Derived asset format to download (default: original upload)',
      },
      output: {
        alias: 'o',
        type: 'string',
        description: 'Output file path (defaults to asset filename)',
      },
      ...getOrgOption(),
      ...getProjectOption(),
    }),
  handler: async (argv) => {
    const { assetName, version: requestedVersion } = resolveAssetInput(argv, { version: 'read' });
    const debugCliTasks = process.env.DEBUG_CLI_ASSET_TASKS === '1' || process.env.DEBUG_CLI_ASSET_TASKS === 'true';
    const orgName = argv.org;
    const projectName = argv.project;
    const format = argv.format;

    const client = await createClient(getCliDeps(argv));
    const selected = await getAsset(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName: formatAssetReference(assetName, requestedVersion),
      },
    });
    const version = selected.version;

    let fileData: Readable;
    let filename: string;

    if (format) {
      const params = { orgName, projectName, assetName, version };
      const typedFormat = format;
      if (debugCliTasks) {
        console.log('[cli assets download] startMediaTask', {
          asset: assetName,
          format: typedFormat,
        });
      }
      const start = await startMediaTask(client, {
        params,
        format: typedFormat,
        query: { download: true, cache: false },
      });
      if (start.status === 'SUCCESS') {
        if (debugCliTasks) {
          console.log('[cli assets download] media ready without task wait', {
            asset: assetName,
            format: typedFormat,
          });
        }
      } else if (start.status === 'FAILED') {
        throw new Error('Media task failed before download could be prepared');
      } else {
        if (start.taskId == null) {
          throw new Error(`Media task status ${start.status} did not include a taskId`);
        }
        if (debugCliTasks) {
          console.log('[cli assets download] waiting for task completion', {
            asset: assetName,
            format: typedFormat,
            taskId: start.taskId,
          });
        }
        await waitForTaskCompletion(client, {
          params: { orgName, projectName, taskId: start.taskId },
          timeoutMs: 180_000,
        });
        if (debugCliTasks) {
          console.log('[cli assets download] task completed', {
            asset: assetName,
            format: typedFormat,
            taskId: start.taskId,
          });
        }
      }
      if (debugCliTasks) {
        console.log('[cli assets download] media task response', {
          asset: assetName,
          format: typedFormat,
          status: start.status,
          taskId: start.taskId ?? null,
        });
      }

      if (debugCliTasks) {
        console.log('[cli assets download] fetching media', {
          asset: assetName,
          format: typedFormat,
        });
      }
      const result = await getMedia(
        client,
        {
          params,
          format: typedFormat,
          query: { download: true },
        },
        'stream',
      );
      fileData = result.data;
      filename = getDownloadFilename(selected.name, format);
    } else {
      if (debugCliTasks) {
        console.log('[cli assets download] fetching original media', { asset: assetName });
      }
      const url = getMediaOriginalUrl(client, {
        extension: selected.originalExtension,
        params: { orgName, projectName, assetName, version },
        query: { download: true },
      });
      const result = await client.axios.get(url.toString(), { responseType: 'stream' });
      fileData = result.data as Readable;
      filename = getDownloadFilename(selected.name, selected.originalExtension);
    }

    const outputPath = argv.output ?? filename;
    if (debugCliTasks) {
      console.log('[cli assets download] writing output', { asset: assetName, outputPath });
    }
    await writeFile(outputPath, fileData);
  },
});
