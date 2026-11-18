import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import { getAsset, formatAssetReference } from '@threeify/sdk';
import { writeFile } from 'node:fs/promises';
import { getMedia, startMediaTask, waitForTaskCompletion } from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'thumbnail [assetReference]',
  describe: 'Download asset thumbnail',
  builder: (yargs) =>
    withAssetInput(yargs, { version: 'read' }).options({
      width: {
        type: 'number',
        description: 'Thumbnail width',
      },
      height: {
        type: 'number',
        description: 'Thumbnail height',
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
    const client = await createClient(getCliDeps(argv));
    const selected = await getAsset(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName: formatAssetReference(assetName, requestedVersion),
      },
    });

    const params = {
      orgName: argv.org,
      projectName: argv.project,
      assetName: selected.name,
      version: selected.version,
    };
    const start = await startMediaTask(client, {
      params,
      format: 'webp',
      query: {
        width: argv.width,
        height: argv.height,
        cache: false,
      },
    });
    if (debugCliTasks) {
      console.log('[cli assets thumbnail] startMediaTask', {
        asset: assetName,
        status: start.status,
        taskId: start.taskId ?? null,
      });
    }
    if (start.status === 'SUCCESS') {
      if (debugCliTasks) {
        console.log('[cli assets thumbnail] media ready without task wait');
      }
    } else if (start.status === 'FAILED') {
      throw new Error('Thumbnail task failed before media could be prepared');
    } else {
      if (start.taskId == null) {
        throw new Error(`Thumbnail task status ${start.status} did not include a taskId`);
      }
      if (debugCliTasks) {
        console.log('[cli assets thumbnail] waiting for task completion', { taskId: start.taskId });
      }
      await waitForTaskCompletion(client, {
        params: { orgName: argv.org, projectName: argv.project, taskId: start.taskId },
        timeoutMs: 180_000,
      });
      if (debugCliTasks) {
        console.log('[cli assets thumbnail] task completed', { taskId: start.taskId });
      }
    }

    if (debugCliTasks) {
      console.log('[cli assets thumbnail] fetching media', { asset: assetName, format: 'webp' });
    }
    const thumbnailData = await getMedia(
      client,
      {
        params,
        format: 'webp',
        query: {
          width: argv.width,
          height: argv.height,
        },
      },
      'stream',
    );

    const outputPath = argv.output ?? `${assetName}_thumbnail.png`;
    if (debugCliTasks) {
      console.log('[cli assets thumbnail] writing output', { outputPath });
    }
    await writeFile(outputPath, thumbnailData);
  },
});
