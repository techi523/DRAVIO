const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies from node_modules
config.resolver.disableHierarchicalLookup = false;

// 4. Explicitly alias react-native to react-native-web for web builds
// Also mock any native-only packages that are not available in Expo Go / Web.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native-web'),
  'react-native-wireguard-vpn': path.resolve(projectRoot, 'src/mocks/wireguard-mock.js'),
};

module.exports = config;
