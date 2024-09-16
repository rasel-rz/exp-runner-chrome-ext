const activeStatus = {};
const HTTPS_STORAGE_KEY = 'exp-runner-https';

chrome.action.onClicked.addListener(async (tab) => {
    activeStatus[tab.id] = !activeStatus[tab.id];
    setLogo(activeStatus[tab.id], tab.id);
    executeScript(tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    activate(tabId);
});

chrome.webNavigation.onCommitted.addListener(({ tabId, frameType }) => {
    if (frameType !== 'outermost_frame') return;
    activate(tabId);
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'switch-http-or-https') return toggleHttpOrHttps();
});

function activate(tabId) {
    setHttpOrHttpsBadge().then(() => {
        setLogo(activeStatus[tabId], tabId);
        activeStatus[tabId] && executeScript(tabId);
    });
}

function toggleHttpOrHttps() {
    chrome.storage.local.get(HTTPS_STORAGE_KEY, (data) => {
        const value = data[HTTPS_STORAGE_KEY];
        if (value === 'true') return chrome.storage.local.remove(HTTPS_STORAGE_KEY, setHttpOrHttpsBadge);
        chrome.storage.local.set({ [HTTPS_STORAGE_KEY]: 'true' }, setHttpOrHttpsBadge);
    });
}

function isHttps() {
    return new Promise((resolve) => {
        chrome.storage.local.get(HTTPS_STORAGE_KEY, (data) => {
            resolve(data[HTTPS_STORAGE_KEY] === 'true');
        });
    });
}

function setHttpOrHttpsBadge() {
    return new Promise((resolve) => {
        isHttps().then((isHttps) => {
            chrome.action.setBadgeText({ text: (isHttps ? '://' : '') });
            resolve(isHttps);
        });
    });
}

function setLogo(isActive, tabId) {
    try {
        chrome.action.setIcon({ path: "./../logo/logo-" + (isActive ? 'a' : 'd') + "-16.png", tabId: tabId });
    } catch (e) {
        console.trace(e);
    }
}

function executeScript(tabId) {
    isHttps().then((isHttps) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (isHttps) => {
                !(() => {
                    if (window.experiment_runner_loaded) return;
                    const script = document.createElement("script");
                    script.src = (isHttps ? 'https' : 'http') + "://localhost:3001/experiment-runner.js";
                    document.head.append(script);
                    window.experiment_runner_loaded = true;
                })();
            },
            args: [isHttps]
        });
    });
}