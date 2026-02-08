/**
 * Popup Script - 自动清理浏览记录
 * 功能：弹出窗口的用户界面逻辑
 */

console.log('History Auto Cleaner popup script loaded');

// DOM 元素引用
let mainContainer, statusContainer, openOptionsBtn;

// 存储配置的键名
const STORAGE_KEY = 'privateDomains';

/**
 * 初始化弹出窗口
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取 DOM 元素引用
    mainContainer = document.getElementById('mainContainer');
    statusContainer = document.getElementById('statusContainer');
    openOptionsBtn = document.getElementById('openOptionsBtn');

    // 绑定事件监听器
    openOptionsBtn.addEventListener('click', openOptionsPage);

    // 加载数据
    loadData();
});

/**
 * 加载数据
 */
async function loadData() {
    try {
        // 检查扩展状态
        const extensionStatus = await checkExtensionStatus();
        
        // 更新界面
        updateStatus(extensionStatus);
        
    } catch (error) {
        console.error('Failed to load data:', error);
        showError('加载数据失败');
    }
}

/**
 * 检查扩展状态
 */
async function checkExtensionStatus() {
    try {
        // 尝试与 service worker 通信
        const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
        return response ? 'active' : 'inactive';
    } catch (error) {
        console.warn('Service worker not responding:', error);
        return 'inactive';
    }
}

/**
 * 更新扩展状态显示
 */
function updateStatus(status) {
    const statusText = statusContainer.querySelector('span');
    
    if (status === 'active') {
        statusContainer.className = 'status active';
        statusText.textContent = '扩展运行正常';
    } else {
        statusContainer.className = 'status inactive';
        statusText.textContent = '扩展可能未正常工作';
    }
}



/**
 * 显示错误信息
 */
function showError(message) {
    statusContainer.className = 'status inactive';
    statusContainer.querySelector('span').textContent = message;
}

/**
 * 打开选项页面
 */
function openOptionsPage() {
    try {
        chrome.runtime.openOptionsPage();
        // 关闭弹窗
        window.close();
    } catch (error) {
        console.error('Failed to open options page:', error);
        // 降级方案：在新标签页打开
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        window.close();
    }
} 