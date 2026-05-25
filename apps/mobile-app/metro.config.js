const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const metroResolver = require('metro-resolver');
const os = require('os');

// Find the project and workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ============================================================
// PERFORMANCE OPTIMIZATIONS (low-RAM, low-CPU machine)
// ============================================================

// Use all available CPU cores for transformation (i5-7600T has 4)
config.transformer = {
  ...config.transformer,
  // Limit workers to avoid OOM on 8GB machine
  maxWorkers: Math.min(os.cpus().length, 3),
  // Minify only in production builds — skip in dev for speed
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: false,
    output: { comments: false },
  },
};

// Faster file watching — use polling only as fallback
config.watcher = {
  ...config.watcher,
  // Reduce file system events debounce (faster reload)
  additionalExts: ['mjs', 'cjs'],
};

// Cache configuration — keep Metro cache warm between restarts (uses default disk cache)

// ============================================================
// MONOREPO RESOLVER (preserved from original)
// ============================================================

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies from node_modules
config.resolver.disableHierarchicalLookup = false;

// 4. Custom resolveRequest to conditionally alias react-native for web only
//    Also mocks WireGuard VPN for web platform (not available on web)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native') {
    return metroResolver.resolve(
      context,
      platform === 'web' ? 'react-native-web' : 'react-native',
      platform
    );
  }

  if (moduleName === 'react-native-wireguard-vpn' && platform === 'web') {
    return metroResolver.resolve(
      context,
      path.resolve(projectRoot, 'src/mocks/wireguard-mock.js'),
      platform
    );
  }

  return metroResolver.resolve(context, moduleName, platform);
};

// 5. Extra node modules — extend without breaking native builds
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

module.exports = config;

