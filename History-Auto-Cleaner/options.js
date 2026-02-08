/**
 * Options Page Script - 自动清理浏览记录
 * 功能：管理私有域名列表的用户界面逻辑
 */

console.log('History Auto Cleaner options page script loaded');

// DOM 元素引用
let domainInput, addButton, domainContainer, toastNotification, versionNumber;
let unlockedSection, configFileBtn, configModal, configTextarea, configCancelBtn, configSaveBtn;

// 存储配置的键名
const STORAGE_KEY = 'privateDomains';

// 配置数据
let config = {
    isUnlocked: false,
    privateDomains: {}
};

// 版本号点击相关变量
let clickCount = 0;
let clickTimer = null;

/**
 * 初始化页面
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取 DOM 元素引用
    domainInput = document.getElementById('domainInput');
    addButton = document.getElementById('addButton');
    domainContainer = document.getElementById('domainContainer');
    toastNotification = document.getElementById('toastNotification');
    versionNumber = document.getElementById('versionNumber');
    
    // 解锁功能相关元素
    unlockedSection = document.getElementById('unlockedSection');
    configFileBtn = document.getElementById('configFileBtn');
    configModal = document.getElementById('configModal');
    configTextarea = document.getElementById('configTextarea');
    configCancelBtn = document.getElementById('configCancelBtn');
    configSaveBtn = document.getElementById('configSaveBtn');

    // 绑定事件监听器
    addButton.addEventListener('click', addDomain);
    domainInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addDomain();
        }
    });

    // 绑定版本号点击事件（连续点击解锁功能）
    versionNumber.addEventListener('click', handleVersionClick);

    // 绑定配置文件编辑事件
    configFileBtn.addEventListener('click', showConfigModal);
    configCancelBtn.addEventListener('click', hideConfigModal);
    configSaveBtn.addEventListener('click', saveConfigFile);

    // 点击弹窗外部关闭弹窗
    configModal.addEventListener('click', function(e) {
        if (e.target === configModal) {
            hideConfigModal();
        }
    });

    // ESC 键关闭弹窗
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && configModal.classList.contains('show')) {
            hideConfigModal();
        }
    });

    // 加载并显示配置数据
    loadConfig();
});

/**
 * 加载配置数据
 */
async function loadConfig() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        config = result[STORAGE_KEY] || {
            isUnlocked: false,
            privateDomains: {}
        };
        
        console.log('Loaded config:', config);
        displayDomains();
        updateUnlockedUI();
    } catch (error) {
        console.error('Failed to load config:', error);
        showToast('加载配置失败：' + error.message, 'error');
    }
}

/**
 * 保存配置到存储
 */
async function saveConfig() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: config });
        console.log('Config saved:', config);
        
        // 通知 service worker 更新缓存
        try {
            await chrome.runtime.sendMessage({ 
                action: 'updateConfig', 
                config: config 
            });
        } catch (error) {
            console.warn('Failed to notify service worker:', error);
        }
        
        return true;
    } catch (error) {
        console.error('Failed to save config:', error);
        throw error;
    }
}

/**
 * 更新解锁状态相关的UI显示
 */
function updateUnlockedUI() {
    if (config.isUnlocked) {
        unlockedSection.style.display = 'block';
    } else {
        unlockedSection.style.display = 'none';
    }
}

/**
 * 获取所有域名列表
 */
function getAllDomains() {
    return Object.keys(config.privateDomains);
}

/**
 * 获取可显示的域名列表
 */
function getVisibleDomains() {
    const allDomains = getAllDomains();
    
    if (config.isUnlocked) {
        // 解锁状态：显示所有域名
        return allDomains;
    } else {
        // 未解锁状态：只显示非隐藏域名
        return allDomains.filter(domain => config.privateDomains[domain] === true);
    }
}

/**
 * 检查域名是否隐藏
 */
function isDomainHidden(domain) {
    return config.privateDomains[domain] === false;
}

/**
 * 验证域名格式
 */
function validateDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return { valid: false, message: '域名不能为空' };
    }

    // 移除前后空格
    domain = domain.trim();
    
    if (domain.length === 0) {
        return { valid: false, message: '域名不能为空' };
    }

    if (domain.length > 253) {
        return { valid: false, message: '域名长度不能超过 253 个字符' };
    }

    // 基本的域名格式检查
    const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.\*)?$/;
    
    if (!domainRegex.test(domain)) {
        return { valid: false, message: '域名格式不正确' };
    }

    // 检查是否包含连续的点
    if (domain.includes('..')) {
        return { valid: false, message: '域名不能包含连续的点' };
    }

    // 检查是否以点开头或结尾（除了通配符）
    if (domain.startsWith('.') && !domain.startsWith('*.')) {
        return { valid: false, message: '域名格式不正确' };
    }
    
    if (domain.endsWith('.') && !domain.endsWith('.*')) {
        return { valid: false, message: '域名格式不正确' };
    }

    return { valid: true, domain: domain };
}



/**
 * 添加新域名
 */
async function addDomain() {
    const domainValue = domainInput.value.trim();
    
    if (!domainValue) {
        showToast('请输入域名', 'error');
        return;
    }

    // 验证域名格式
    const validation = validateDomain(domainValue);
    if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
    }

    const domain = validation.domain;

    try {
        // 检查是否已存在
        if (config.privateDomains.hasOwnProperty(domain)) {
            showToast('该域名已存在', 'error');
            return;
        }

        // 添加新域名（默认为显示状态 true）
        // 注意：*.example.com 格式的通配符会自动匹配根域名和子域名，无需额外添加根域名
        config.privateDomains[domain] = true;
        
        // 保存到存储
        await saveConfig();
        
        // 更新显示
        displayDomains();
        
        // 清空输入框
        domainInput.value = '';
        
        showToast('域名添加成功', 'success');
        
    } catch (error) {
        console.error('Failed to add domain:', error);
        showToast('添加域名失败：' + error.message, 'error');
    }
}

/**
 * 删除域名
 */
async function deleteDomain(domain) {
    if (!confirm(`确定要删除域名 "${domain}" 吗？`)) {
        return;
    }

    try {
        // 删除指定域名
        delete config.privateDomains[domain];
        
        // 保存到存储
        await saveConfig();
        
        // 更新显示
        displayDomains();
        
        showToast('域名删除成功', 'success');
        
    } catch (error) {
        console.error('Failed to delete domain:', error);
        showToast('删除域名失败：' + error.message, 'error');
    }
}

/**
 * 处理版本号点击事件（连续点击三次解锁功能）
 */
function handleVersionClick() {
    clickCount++;
    console.log('Version clicked, count:', clickCount);
    
    // 清除之前的计时器
    if (clickTimer) {
        clearTimeout(clickTimer);
    }
    
    // 如果点击三次，切换解锁状态
    if (clickCount >= 3) {
        toggleUnlockState();
        clickCount = 0; // 重置计数
    } else {
        // 设置计时器，2秒内未达到3次点击则重置计数
        clickTimer = setTimeout(() => {
            clickCount = 0;
            console.log('Click count reset due to timeout');
        }, 2000);
    }
}

/**
 * 切换解锁状态
 */
async function toggleUnlockState() {
    try {
        config.isUnlocked = !config.isUnlocked;
        
        // 保存配置到存储
        await saveConfig();
        
        console.log('Unlock state toggled:', config.isUnlocked);
        
        // 更新UI显示
        displayDomains();
        updateUnlockedUI();
        
        // 显示提示信息
        if (config.isUnlocked) {
            showToast('发现了新大陆~', 'success');
        } else {
            showToast('再度扬帆起航~', 'success');
        }
        
    } catch (error) {
        console.error('Failed to toggle unlock state:', error);
        showToast('切换解锁状态失败：' + error.message, 'error');
    }
}

/**
 * 切换域名的隐藏状态
 */
async function toggleDomainHidden(domain) {
    try {
        const isCurrentlyHidden = isDomainHidden(domain);
        
        // 切换隐藏状态
        config.privateDomains[domain] = isCurrentlyHidden ? true : false;
        
        // 保存配置到存储
        await saveConfig();
        
        console.log(`Domain ${domain} hidden state changed to:`, config.privateDomains[domain]);
        
        // 重新显示域名列表
        displayDomains();
        
        const statusText = isCurrentlyHidden ? '已取消隐藏' : '已设置为隐藏';
        showToast(`域名 "${domain}" ${statusText}`, 'success');
        
    } catch (error) {
        console.error('Failed to toggle domain hidden state:', error);
        showToast('切换隐藏状态失败：' + error.message, 'error');
    }
}

/**
 * 访问域名
 */
function visitDomain(domain) {
    try {
        let targetDomain = '';
        
        // 处理 example.com 格式
        if (!domain.includes('*')) {
            targetDomain = domain;
        }
        // 处理 *.example.com 格式
        else if (domain.startsWith('*.') && domain.split('*').length === 2) {
            // 去掉 *. 前缀
            const baseDomain = domain.substring(2);
            // 检查剩余部分是否还包含通配符
            if (!baseDomain.includes('*')) {
                targetDomain = baseDomain;
            }
        }
        
        if (targetDomain) {
            // 添加协议前缀，避免被当作相对路径
            const url = `http://${targetDomain}`;
            
            // 在新标签页中打开
            chrome.tabs.create({ url: url });
            console.log(`Opening URL: ${url}`);
        } else {
            showToast('不支持打开此域名', 'error');
            console.log(`Cannot open domain pattern: ${domain}`);
        }
    } catch (error) {
        console.error('Failed to visit domain:', error);
        showToast('打开域名失败：' + error.message, 'error');
    }
}

/**
 * 显示域名列表
 */
function displayDomains() {
    const visibleDomains = getVisibleDomains();

    if (visibleDomains.length === 0) {
        domainContainer.innerHTML = '<div class="empty-state">暂无配置的域名</div>';
        return;
    }

    const domainItems = visibleDomains.map(domain => {
        const isHidden = isDomainHidden(domain);
        const hiddenClass = isHidden ? 'hidden' : '';
        const hiddenBadge = isHidden ? '<span class="hidden-badge">隐藏</span>' : '';
        
        // 只在解锁状态下显示隐藏按钮
        let hideButton = '';
        if (config.isUnlocked) {
            const hideButtonText = isHidden ? '取消隐藏' : '隐藏';
            const hideButtonClass = isHidden ? 'unhide' : '';
            hideButton = `<button class="hide-btn ${hideButtonClass}" data-domain="${escapeHtml(domain)}" data-action="toggle-hide">${hideButtonText}</button>`;
        }
        
        return `
            <div class="domain-item ${hiddenClass}">
                <div class="domain-content">
                    <span class="domain-text">${escapeHtml(domain)}</span>
                    ${hiddenBadge}
                </div>
                <div class="domain-actions">
                    ${hideButton}
                    <button class="visit-btn" data-domain="${escapeHtml(domain)}" data-action="visit">访问</button>
                    <button class="delete-btn" data-domain="${escapeHtml(domain)}" data-action="delete">删除</button>
                </div>
            </div>
        `;
    }).join('');

    domainContainer.innerHTML = domainItems;
    
    // 为所有按钮添加事件监听器
    const actionButtons = domainContainer.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const domain = this.getAttribute('data-domain');
            const action = this.getAttribute('data-action');
            
            if (action === 'delete') {
                deleteDomain(domain);
            } else if (action === 'toggle-hide') {
                toggleDomainHidden(domain);
            } else if (action === 'visit') {
                visitDomain(domain);
            }
        });
    });
}

/**
 * 显示配置文件编辑弹窗
 */
function showConfigModal() {
    // 格式化当前配置为 JSON
    const configJson = JSON.stringify(config, null, 2);
    configTextarea.value = configJson;
    
    configModal.classList.add('show');
    
    // 聚焦到文本框
    setTimeout(() => {
        configTextarea.focus();
    }, 100);
}

/**
 * 隐藏配置文件编辑弹窗
 */
function hideConfigModal() {
    configModal.classList.remove('show');
}

/**
 * 保存配置文件
 */
async function saveConfigFile() {
    const configText = configTextarea.value.trim();
    
    if (!configText) {
        showToast('请输入配置内容', 'error');
        return;
    }

    try {
        // 解析 JSON
        const newConfig = JSON.parse(configText);
        
        // 基本格式验证
        if (!newConfig || typeof newConfig !== 'object') {
            throw new Error('配置格式不正确');
        }
        
        // 验证必要的字段
        if (!newConfig.hasOwnProperty('isUnlocked') || 
            !newConfig.hasOwnProperty('privateDomains') ||
            typeof newConfig.privateDomains !== 'object') {
            throw new Error('配置结构不完整');
        }
        
        // 二次确认对话框
        const confirmMessage = 
            '⚠️ 确认保存配置文件？\n\n' +
            '此操作将完全覆盖现有的配置内容，包括：\n' +
            '• 所有已配置的域名\n' +
            '• 域名的显示/隐藏状态\n' +
            '• 解锁状态设置\n\n' +
            '覆盖后无法恢复原有配置，请确认您已备份重要数据。\n\n' +
            '是否继续保存？';
        
        const userConfirmed = confirm(confirmMessage);
        if (!userConfirmed) {
            console.log('User cancelled config file save operation');
            return;
        }
        
        // 直接覆盖现有配置
        config = {
            isUnlocked: Boolean(newConfig.isUnlocked),
            privateDomains: newConfig.privateDomains || {}
        };
        
        // 保存到存储
        await saveConfig();
        
        // 更新显示
        displayDomains();
        updateUnlockedUI();
        
        // 关闭弹窗并显示成功提示
        hideConfigModal();
        showToast('配置保存成功', 'success');
        
        console.log('Config file saved:', config);
        
    } catch (error) {
        console.error('Failed to save config file:', error);
        
        let errorMessage = '格式错误';
        if (error.message.includes('JSON')) {
            errorMessage = 'JSON 格式错误';
        } else if (error.message.includes('配置')) {
            errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
    }
}

/**
 * 显示右下角 Toast 提示
 */
function showToast(message, type = 'success') {
    // 设置提示内容和样式
    toastNotification.textContent = message;
    toastNotification.className = `toast-notification ${type}`;
    
    // 显示提示
    toastNotification.classList.add('show');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3000);
}

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 