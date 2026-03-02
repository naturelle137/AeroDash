module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'ac',
        'ap',
        'ad',
        'fe',
        'mb',
        'pf',
        'wx',
        'ui',
        'uq',
        'sys',
        'doc',
        'sc',
        'repo'
      ]
    ],
    'scope-empty': [2, 'never']
  }
};
