export enum RefreshTokenType {
  SESSION = 'SESSION',
  API_TOKEN = 'API_TOKEN',
}

export namespace Enums {
  export const UserType = ['STANDARD', 'SERVICE_ACCOUNT'] as const;
  export type UserType = (typeof UserType)[number];

  export const Visibility = ['PRIVATE', 'PUBLIC'] as const;
  export type Visibility = (typeof Visibility)[number];

  export const AssetVisibility = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;
  export type AssetVisibility = (typeof AssetVisibility)[number];

  export const ShareLicense = [
    'NONE',
    'CC_0',
    'CC_BY',
    'CC_BY_SA',
    'CC_BY_NC',
    'CC_BY_NC_SA',
    'CC_BY_ND',
    'CC_BY_NC_ND',
  ] as const;
  export type ShareLicense = (typeof ShareLicense)[number];

  export const AssetType = ['MODEL', 'MATERIAL', 'IMAGE', 'SCENE', 'ENVMAP', 'CAD', 'LIGHT'] as const;
  export type AssetType = (typeof AssetType)[number];

  export const CommentMode = ['ENABLED', 'MEMBERS_ONLY', 'NONE'] as const;
  export type CommentMode = (typeof CommentMode)[number];

  export const MemberRole = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
  export type MemberRole = (typeof MemberRole)[number];

  export const MemberType = ['ORG', 'PROJECT'] as const;
  export type MemberType = (typeof MemberType)[number];

  export const MemberInviteStatus = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
  export type MemberInviteStatus = (typeof MemberInviteStatus)[number];

  export const NotificationStatus = ['UNREAD', 'READ'] as const;
  export type NotificationStatus = (typeof NotificationStatus)[number];

  export const NotificationLevel = ['DEFAULT', 'ERROR'] as const;
  export type NotificationLevel = (typeof NotificationLevel)[number];

  export const FileOwnerType = ['USER', 'ORG', 'PROJECT'] as const;
  export type FileOwnerType = (typeof FileOwnerType)[number];

  export const ApiTokenType = ['SECRET', 'FRONTEND'] as const;
  export type ApiTokenType = (typeof ApiTokenType)[number];

  export const UserInviteStatus = ['PENDING', 'APPROVED', 'REJECTED', 'REDEEMED'] as const;
  export type UserInviteStatus = (typeof UserInviteStatus)[number];

  export const SocialLinkType = [
    'BLUESKY',
    'FACEBOOK',
    'GITHUB',
    'INSTAGRAM',
    'LINKEDIN',
    'MASTODON',
    'REDDIT',
    'TIKTOK',
    'YOUTUBE',
    'TWITTER',
    'CUSTOM',
  ] as const;
  export type SocialLinkType = (typeof SocialLinkType)[number];

  export const FileEncoding = ['raw', 'br', 'zstd', 'gzip'] as const;
  export type FileEncoding = (typeof FileEncoding)[number];

  export const NotificationTopic = [
    'NEW_COMMENT',
    'COMMENT_MODERATED',
    'ASSET_MODERATED',
    'PROJECT_INVITE',
    'ORG_INVITE',
    'ASSET_LIKED',
    'COMMENT_LIKED',
    'COMMENT_MENTIONED',
    'EXTERNAL_AUTH_APPROVED',
    'NEW_ASSET',
    'NEW_ASSET_VERSION',
  ] as const;
  export type NotificationTopic = (typeof NotificationTopic)[number];

  export const AssetReportAction = ['RESTRICT', 'IGNORE'] as const;
  export type AssetReportAction = (typeof AssetReportAction)[number];

  export const FileRole = ['AVATAR', 'ASSET', 'THUMBNAIL'] as const;
  export type FileRole = (typeof FileRole)[number];

  export const UserUploadPurpose = ['ASSET'] as const;
  export type UserUploadPurpose = (typeof UserUploadPurpose)[number];

  export const CountryCode = [
    '~',
    'AD',
    'AE',
    'AF',
    'AG',
    'AI',
    'AL',
    'AM',
    'AO',
    'AQ',
    'AR',
    'AS',
    'AT',
    'AU',
    'AW',
    'AX',
    'AZ',
    'BA',
    'BB',
    'BD',
    'BE',
    'BF',
    'BG',
    'BH',
    'BI',
    'BJ',
    'BL',
    'BM',
    'BN',
    'BO',
    'BQ',
    'BR',
    'BS',
    'BT',
    'BV',
    'BW',
    'BY',
    'BZ',
    'CA',
    'CC',
    'CD',
    'CF',
    'CG',
    'CH',
    'CI',
    'CK',
    'CL',
    'CM',
    'CN',
    'CO',
    'CR',
    'CU',
    'CV',
    'CW',
    'CX',
    'CY',
    'CZ',
    'DE',
    'DJ',
    'DK',
    'DM',
    'DO',
    'DZ',
    'EC',
    'EE',
    'EG',
    'EH',
    'ER',
    'ES',
    'ET',
    'FI',
    'FJ',
    'FK',
    'FM',
    'FO',
    'FR',
    'GA',
    'GB',
    'GD',
    'GE',
    'GF',
    'GG',
    'GH',
    'GI',
    'GL',
    'GM',
    'GN',
    'GP',
    'GQ',
    'GR',
    'GS',
    'GT',
    'GU',
    'GW',
    'GY',
    'HK',
    'HM',
    'HN',
    'HR',
    'HT',
    'HU',
    'ID',
    'IE',
    'IL',
    'IM',
    'IN',
    'IO',
    'IQ',
    'IR',
    'IS',
    'IT',
    'JE',
    'JM',
    'JO',
    'JP',
    'KE',
    'KG',
    'KH',
    'KI',
    'KM',
    'KN',
    'KP',
    'KR',
    'KW',
    'KY',
    'KZ',
    'LA',
    'LB',
    'LC',
    'LI',
    'LK',
    'LR',
    'LS',
    'LT',
    'LU',
    'LV',
    'LY',
    'MA',
    'MC',
    'MD',
    'ME',
    'MF',
    'MG',
    'MH',
    'MK',
    'ML',
    'MM',
    'MN',
    'MO',
    'MP',
    'MQ',
    'MR',
    'MS',
    'MT',
    'MU',
    'MV',
    'MW',
    'MX',
    'MY',
    'MZ',
    'NA',
    'NC',
    'NE',
    'NF',
    'NG',
    'NI',
    'NL',
    'NO',
    'NP',
    'NR',
    'NU',
    'NZ',
    'OM',
    'PA',
    'PE',
    'PF',
    'PG',
    'PH',
    'PK',
    'PL',
    'PM',
    'PN',
    'PR',
    'PS',
    'PT',
    'PW',
    'PY',
    'QA',
    'RE',
    'RO',
    'RS',
    'RU',
    'RW',
    'SA',
    'SB',
    'SC',
    'SD',
    'SE',
    'SG',
    'SH',
    'SI',
    'SJ',
    'SK',
    'SL',
    'SM',
    'SN',
    'SO',
    'SR',
    'SS',
    'ST',
    'SV',
    'SY',
    'SZ',
    'TC',
    'TD',
    'TF',
    'TG',
    'TH',
    'TJ',
    'TK',
    'TL',
    'TM',
    'TN',
    'TO',
    'TR',
    'TT',
    'TV',
    'TW',
    'TZ',
    'UA',
    'UG',
    'UM',
    'US',
    'UY',
    'UZ',
    'VA',
    'VC',
    'VE',
    'VG',
    'VI',
    'VN',
    'VU',
    'WF',
    'WS',
    'YE',
    'ZM',
    'ZW',
  ] as const;
  export type CountryCode = (typeof CountryCode)[number];

  export const PlanType = ['FREE', 'BASIC_MONTHLY', 'BASIC_YEARLY', 'ENTERPRISE'] as const;
  export type PlanType = (typeof PlanType)[number];

  export const GlbMeshCompress = ['draco', 'meshopt', 'quantize'] as const;
  export type GlbMeshCompress = (typeof GlbMeshCompress)[number];

  export const GlbTextureCompress = ['ktx2', 'webp', 'avif', 'auto'] as const;
  export type GlbTextureCompress = (typeof GlbTextureCompress)[number];
}
