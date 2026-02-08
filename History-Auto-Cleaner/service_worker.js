/**
 * Chrome Extension Service Worker - 自动清理浏览记录
 * 功能：监听页面导航，自动删除配置域名的历史记录
 */

console.log('History Auto Cleaner service worker loaded');

// 存储配置的键名
const STORAGE_KEY = 'privateDomains';

// 缓存配置数据，避免频繁读取 storage
let cachedConfig = {
  isUnlocked: false,
  privateDomains: {}
};

/**
 * 初始化：加载用户配置
 */
async function initializeConfig() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    cachedConfig = result[STORAGE_KEY] || {
      isUnlocked: false,
      privateDomains: {}
    };
    console.log('Loaded config from storage:', cachedConfig);
  } catch (error) {
    console.error('Failed to load config from storage:', error);
    cachedConfig = {
      isUnlocked: false,
      privateDomains: {}
    };
  }
}

/**
 * 获取所有域名列表（用于匹配检查）
 */
function getAllDomains() {
  return Object.keys(cachedConfig.privateDomains);
}

/**
 * 检查 URL 是否匹配配置的域名模式
 * 支持通配符匹配，如 *.example.com
 */
function isUrlMatched(url, patterns) {
  if (!url || !patterns.length) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return patterns.some(pattern => {
      // 移除前后空格
      pattern = pattern.trim();
      if (!pattern) return false;
      
      // 支持通配符 * 匹配
      if (pattern.includes('*')) {
        // 特殊处理 *.example.com 格式：同时匹配子域名和根域名
        if (pattern.startsWith('*.') && !pattern.endsWith('.*')) {
          const rootDomain = pattern.substring(2); // 移除 *. 前缀获取根域名
          
          // 检查是否匹配根域名
          if (hostname === rootDomain) {
            return true;
          }
          
          // 检查是否匹配子域名
          if (hostname.endsWith('.' + rootDomain)) {
            return true;
          }
          
          return false;
        }
        
        // 其他通配符格式（如 *.example.*）使用原有正则表达式处理
        const regexPattern = pattern
          .replace(/\./g, '\\.')  // 转义点号
          .replace(/\*/g, '.*');  // * 替换为 .*
        
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        return regex.test(hostname);
      } else {
        // 精确匹配或子域名匹配
        return hostname === pattern || hostname.endsWith('.' + pattern);
      }
    });
  } catch (error) {
    console.error('Error parsing URL:', url, error);
    return false;
  }
}

/**
 * 删除指定 URL 的历史记录
 */
async function deleteUrlFromHistory(url) {
  try {
    await chrome.history.deleteUrl({ url: url });
    console.log('Deleted from history:', url);
  } catch (error) {
    console.error('Failed to delete URL from history:', url, error);
  }
}

/**
 * 处理导航提交事件（页面开始导航时触发）
 * 主要用于传统的多页应用（MPA）导航
 */
async function handleNavigationCommitted(details) {
  // 只处理主框架的导航（忽略 iframe 等）
  if (details.frameId !== 0) return;
  
  const url = details.url;
  const allDomains = getAllDomains();
  
  // 只有匹配到配置域名时才处理和输出日志
  if (isUrlMatched(url, allDomains)) {
    console.log('Navigation committed (matched):', url);
    console.log('URL matches domain, will delete from history:', url);
    
    // 延迟删除，确保历史记录已经写入
    setTimeout(async () => {
      await deleteUrlFromHistory(url);
    }, 1000);
  }
}

/**
 * 处理历史状态更新事件（SPA 路由切换时触发）
 * 主要用于单页应用（SPA）的路由变化，如使用 pushState/replaceState 的路由
 */
async function handleHistoryStateUpdated(details) {
  // 只处理主框架的导航（忽略 iframe 等）
  if (details.frameId !== 0) return;
  
  const url = details.url;
  const allDomains = getAllDomains();
  
  // 只有匹配到配置域名时才处理和输出日志
  if (isUrlMatched(url, allDomains)) {
    console.log('History state updated (SPA navigation, matched):', url);
    console.log('SPA URL matches domain, will delete from history:', url);
    
    // SPA 路由切换后延迟删除，确保历史记录已经写入
    // 对于 SPA，延迟时间可以稍短一些，因为不需要加载新页面
    setTimeout(async () => {
      await deleteUrlFromHistory(url);
    }, 1000);
  }
}

/**
 * 处理引用片段更新事件（hash 路由变化时触发）
 * 主要用于单页应用（SPA）的 hash 路由变化，如 #/route1 到 #/route2
 */
async function handleReferenceFragmentUpdated(details) {
  // 只处理主框架的导航（忽略 iframe 等）
  if (details.frameId !== 0) return;
  
  const url = details.url;
  const allDomains = getAllDomains();
  
  // 只有匹配到配置域名时才处理和输出日志
  if (isUrlMatched(url, allDomains)) {
    console.log('Reference fragment updated (hash navigation, matched):', url);
    console.log('Hash URL matches domain, will delete from history:', url);
    
    // Hash 路由切换后延迟删除，确保历史记录已经写入
    // Hash 路由变化通常很快，延迟时间可以更短
    setTimeout(async () => {
      await deleteUrlFromHistory(url);
    }, 1000);
  }
}

/**
 * 处理存储变化事件，更新缓存配置
 */
function handleStorageChanged(changes, namespace) {
  if (changes[STORAGE_KEY]) {
    cachedConfig = changes[STORAGE_KEY].newValue || {
      isUnlocked: false,
      privateDomains: {}
    };
    console.log('Config updated:', cachedConfig);
  }
}

// 注册事件监听器
chrome.webNavigation.onCommitted.addListener(handleNavigationCommitted);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleHistoryStateUpdated);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(handleReferenceFragmentUpdated);
chrome.storage.onChanged.addListener(handleStorageChanged);

// Service Worker 启动时初始化
initializeConfig();

// 处理来自 popup/options 页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    sendResponse({ config: cachedConfig });
  } else if (request.action === 'updateConfig') {
    cachedConfig = request.config || {
      isUnlocked: false,
      privateDomains: {}
    };
    sendResponse({ success: true });
  }
});

console.log('Service worker event listeners registered'); 