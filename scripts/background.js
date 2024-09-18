const activeStatus = {};
const HTTPS_STORAGE_KEY = 'exp-runner-https';
const NO_SOCKET_STORAGE_KEY = 'exp-runner-no-socket';

chrome.action.onClicked.addListener(async (tab) => {
    activeStatus[tab.id] = !activeStatus[tab.id];
    activate(tab.id);
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
    if (command === 'no-scoket-mode') return toggleNoSocketMode();
});

function activate(tabId) {
    updateBadge().then(() => {
        setLogo(activeStatus[tabId], tabId);
        activeStatus[tabId] && executeScript(tabId);
    });
}

function toggleNoSocketMode() {
    chrome.storage.local.get(NO_SOCKET_STORAGE_KEY, (data) => {
        const value = data[NO_SOCKET_STORAGE_KEY];
        if (value === 'true') return chrome.storage.local.remove(NO_SOCKET_STORAGE_KEY, updateBadge);
        chrome.storage.local.set({ [NO_SOCKET_STORAGE_KEY]: 'true' }, updateBadge);
    });
}

function isNoSocketMode() {
    return new Promise((resolve) => {
        chrome.storage.local.get(NO_SOCKET_STORAGE_KEY, (data) => {
            resolve(data[NO_SOCKET_STORAGE_KEY] === 'true');
        });
    });
}

function toggleHttpOrHttps() {
    chrome.storage.local.get(HTTPS_STORAGE_KEY, (data) => {
        const value = data[HTTPS_STORAGE_KEY];
        if (value === 'true') return chrome.storage.local.remove(HTTPS_STORAGE_KEY, updateBadge);
        chrome.storage.local.set({ [HTTPS_STORAGE_KEY]: 'true' }, updateBadge);
    });
}

function isHttps() {
    return new Promise((resolve) => {
        chrome.storage.local.get(HTTPS_STORAGE_KEY, (data) => {
            resolve(data[HTTPS_STORAGE_KEY] === 'true');
        });
    });
}

function updateBadge() {
    return new Promise((resolve) => {
        Promise.all([isHttps(), isNoSocketMode()]).then(([isHttps, isNoSocketMode]) => {
            chrome.action.setBadgeText({ text: `${isHttps ? ':/' : ''}${isNoSocketMode ? '$' : ''}` });
            resolve(true);
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
    Promise.all([isHttps(), isNoSocketMode()]).then(([isHttps, isNoSocketMode]) => {
        !isNoSocketMode &&
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (isHttps) => {
                    !(() => {
                        if (window.experiment_runner_loaded) return;
                        window.experiment_runner_loaded = true;
                        const protocol = isHttps ? 'https' : 'http';
                        const script = document.createElement("script");
                        script.src = protocol + "://localhost:3001/experiment-runner.js";
                        document.head.append(script);
                    })();
                },
                args: [isHttps]
            });

        isNoSocketMode &&
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (isHttps) => {
                    if (window.experiment_runner_loaded) return;
                    window.experiment_runner_loaded = true;
                    const protocol = isHttps ? 'https' : 'http';
                    const script = document.createElement("script");
                    script.src = protocol + "://localhost:3001/variation.js";
                    const style = document.createElement("link");
                    style.rel = "stylesheet";
                    style.href = protocol + "://localhost:3001/variation.css";
                    document.head.append(script, style);
                    script.onload = () => console.log("Experiment runner loaded without hot reload");
                    return;

                },
                args: [isHttps]
            });
    });
}

// Keep the service worker alive
setInterval(() => {
    chrome.storage.local.get();
}, 20 * 1000);