import { cpus } from 'node:os';
import * as sdk from '@threeify/sdk';
import { getOrg, getProject } from './config-defaults.ts';

/**
 * Format types for output.
 */
export const FormatType = ['json', 'yaml', 'csv'] as const;
export type FormatType = (typeof FormatType)[number];

/**
 * Option definition objects for use with .options() spread pattern.
 * These can be spread into yargs.options() calls for a cleaner syntax.
 */

/**
 * Get asset visibility option definition (optional).
 * @returns Option object that can be spread into .options()
 */
export const getAssetVisibilityOption = () =>
  ({
    visibility: {
      type: 'string' as const,
      choices: sdk.Enums.AssetVisibility,
      description: 'Asset visibility',
    },
  }) as const;

/**
 * Get asset visibility option definition (required).
 * @returns Option object that can be spread into .options()
 */
export const getAssetVisibilityRequiredOption = () =>
  ({
    visibility: {
      type: 'string' as const,
      choices: sdk.Enums.AssetVisibility,
      description: 'Asset visibility',
      demandOption: true as const,
    },
  }) as const;

/**
 * Get license option definition.
 * @returns Option object that can be spread into .options()
 */
export const getLicenseOption = () =>
  ({
    license: {
      type: 'string' as const,
      description: 'Share license',
      choices: sdk.Enums.ShareLicense,
    },
  }) as const;

/**
 * Get org option definition with dynamic default handling.
 * Returns an option object that can be spread into .options().
 * Note: For proper type inference with demandOption, consider using withOrg() instead.
 */
export const getOrgOption = () => {
  const org = getOrg();
  if (org) {
    return {
      org: {
        type: 'string' as const,
        description: 'Organization name',
        default: org,
      },
    };
  }
  return {
    org: {
      type: 'string' as const,
      description: 'Organization name',
      demandOption: true as const,
    },
  };
};

/**
 * Get parallel option definition with CPU-based default.
 * Defaults to half the number of CPU cores (minimum 1).
 * @returns Option object that can be spread into .options()
 */
export const getParallelOption = () => {
  const defaultParallel = Math.max(1, Math.floor(cpus().length / 2));
  return {
    parallel: {
      type: 'number' as const,
      description: 'Number of parallel operations',
      default: defaultParallel,
      minimum: 1,
    },
  } as const;
};

/**
 * Get project option definition with dynamic default handling.
 * Returns an option object that can be spread into .options().
 * Note: For proper type inference with demandOption, consider using withProject() instead.
 */
export const getProjectOption = () => {
  const project = getProject();
  if (project) {
    return {
      project: {
        type: 'string' as const,
        description: 'Project name',
        default: project,
      },
    };
  }
  return {
    project: {
      type: 'string' as const,
      description: 'Project name',
      demandOption: true as const,
    },
  };
};

/**
 * Get optional project option definition with dynamic default handling.
 * Returns an option object that can be spread into .options().
 * Note: For proper type inference with demandOption, consider using withProjectOptional() instead.
 */
export const getProjectOptionalOption = () => {
  const project = getProject();
  if (project) {
    return {
      project: {
        type: 'string' as const,
        description: 'Project name',
        default: project,
      },
    };
  }
  return {
    project: {
      type: 'string' as const,
      description: 'Project name',
    },
  };
};

/**
 * Get visibility option definition (optional).
 * @returns Option object that can be spread into .options()
 */
export const getVisibilityOption = () =>
  ({
    visibility: {
      type: 'string' as const,
      choices: sdk.Enums.Visibility,
      description: `Visibility`,
    },
  }) as const;

/**
 * Get visibility option definition (required).
 * @returns Option object that can be spread into .options()
 */
export const getVisibilityRequiredOption = () =>
  ({
    visibility: {
      type: 'string' as const,
      choices: sdk.Enums.Visibility,
      description: `Visibility`,
      demandOption: true as const,
    },
  }) as const;

/**
 * Direct option definition objects for use with .options() spread pattern.
 * These are simple constant objects that can be spread directly.
 */

/**
 * Description option definition.
 */
export const descriptionOption = {
  description: {
    type: 'string' as const,
    description: 'Description',
  },
} as const;

/**
 * Metadata option definition.
 * Accepts a string (max 10240 characters) for metadata.
 */
export const metadataOption = {
  metadata: {
    type: 'string' as const,
    description: 'Metadata as a string (max 10240 characters)',
  },
} as const;

/**
 * Format option definition.
 */
export const formatOption = {
  format: {
    alias: 'f',
    type: 'string' as const,
    choices: FormatType,
    description: `Output format`,
    default: 'json' as const,
  },
} as const;

/**
 * Pagination option definitions.
 */
export const paginationOption = {
  'page-offset': {
    type: 'number' as const,
    description: 'Page offset for pagination',
    default: 0 as const,
  },
  'page-size': {
    type: 'number' as const,
    description: 'Page size for pagination',
    default: 20 as const,
  },
} as const;

/**
 * Text option definition (required).
 */
export const textOption = {
  text: {
    type: 'string' as const,
    description: 'Comment text',
    demandOption: true as const,
  },
} as const;
