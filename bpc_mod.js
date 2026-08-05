// Bypass Paywalls Clean - Universal Cache & Focus Mod
// Simply append `importScripts('bpc_mod.js');` to the top of `background.js` when downloading a new version.

if (typeof chrome !== 'undefined' && chrome.scripting && chrome.tabs) {
    // =========================================================
    // BACKGROUND SCRIPT CONTEXT
    // =========================================================
    console.log("[BPC Mod] Initializing background script patches...");

    // Hook executeScript to also inject our content script patch
    if (!self.bpcModPatchedExecuteScript) {
        self.bpcModPatchedExecuteScript = true;
        const originalExecuteScript = chrome.scripting.executeScript;
        chrome.scripting.executeScript = function(injection) {
            if (injection.files && injection.files.includes("contentScript.js")) {
                if (!injection.files.includes("bpc_mod.js")) {
                    injection.files.push("bpc_mod.js");
                }
            }
            return originalExecuteScript.call(this, injection);
        };
    }

} else if (typeof window !== 'undefined' && window.document) {
    // =========================================================
    // CONTENT SCRIPT CONTEXT
    // =========================================================
    if (!window.bpcModPatchedContent) {
        window.bpcModPatchedContent = true;
        console.log("[BPC Mod] Initializing content script patches...");

        if (typeof getArchive === 'function') {
            const originalGetArchive = getArchive;
            
            // Override getArchive to check 24-hour cache first
            getArchive = function(url, paywall_sel, paywall_action = '', selector, text_fail = '', selector_source = selector, selector_archive = selector) {
                let domain = window.location.hostname.replace('www.', '');
                let cacheKey = 'bpc_archive_cache_' + domain + '_' + window.location.pathname;
                let raw = localStorage.getItem(cacheKey);
                
                if (raw) {
                    try {
                        let cacheData = JSON.parse(raw);
                        if (Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000) {
                            console.log('[BPC Mod Cache] Restoring article from 24-hour cache!');
                            let parser = new DOMParser();
                            let dompurifyOpts = (typeof dompurify_options !== 'undefined') ? dompurify_options : {ADD_TAGS: ['amp-img', 'embed', 'iframe', 'list'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'itemprop', 'layout', 'target']};
                            let doc = parser.parseFromString(DOMPurify.sanitize(cacheData.html, dompurifyOpts), 'text/html');
                            let article_new = doc.querySelector(selector_source || selector);
                            
                            if (article_new) {
                                let checkExist = setInterval(() => {
                                    let article = document.querySelector(selector);
                                    let paywall = document.querySelectorAll(paywall_sel);
                                    if (article || paywall.length) {
                                        clearInterval(checkExist);
                                        if (typeof clearPaywall === 'function') clearPaywall(paywall, paywall_action);
                                        
                                        if (article && article.parentNode) {
                                            article.parentNode.replaceChild(article_new, article);
                                            if (typeof func_post === 'function') func_post();
                                        } else {
                                            new MutationObserver((mutations, obs) => {
                                                let art = document.querySelector(selector);
                                                if (art && art.parentNode) {
                                                    art.parentNode.replaceChild(article_new.cloneNode(true), art);
                                                    if (typeof func_post === 'function') func_post();
                                                    obs.disconnect();
                                                }
                                            }).observe(document.documentElement, {childList: true, subtree: true});
                                        }
                                    }
                                }, 100);
                                return; // Stop here, do not fetch
                            }
                        } else {
                            localStorage.removeItem(cacheKey);
                        }
                    } catch(e) {}
                }

                // If cache miss, fetch via original getArchive
                originalGetArchive(url, paywall_sel, paywall_action, selector, text_fail, selector_source, selector_archive);
            };
            
            // Override replaceDomElementExtSrc to SAVE the fetched HTML to cache
            if (typeof replaceDomElementExtSrc === 'function') {
                const originalReplaceDomElementExtSrc = replaceDomElementExtSrc;
                replaceDomElementExtSrc = function(url, url_src, html, proxy, base64, selector, text_fail = '', selector_source = selector, selector_archive = selector, blocked = false) {
                    if (html && !blocked) {
                        let domain = window.location.hostname.replace('www.', '');
                        let cacheKey = 'bpc_archive_cache_' + domain + '_' + window.location.pathname;
                        
                        // Extract just the inner part before caching to save space (same as original extension logic)
                        let parser = new DOMParser();
                        let dompurifyOpts = (typeof dompurify_options !== 'undefined') ? dompurify_options : {ADD_TAGS: ['amp-img', 'embed', 'iframe', 'list'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'itemprop', 'layout', 'target']};
                        
                        // Handle archive.is path rewrites before caching
                        if (url.startsWith('https://archive.') && url_src) {
                            let domain_archive = url.match(/^https:\/\/(archive\.\w{2})/)[1];
                            let pathname = new URL(url_src).pathname;
                            html = html.replace(new RegExp('https:\\/\\/' + domain_archive.replace('.', '\\.') + '\\/o\\/\\w+\\/', 'g'), '')
                                     .replace(new RegExp("(src=\"|background-image:url\\(')" + pathname.replace('/', '\\/'), 'g'), "$1" + 'https://' + domain_archive + pathname);
                        }
                        
                        let doc = parser.parseFromString(DOMPurify.sanitize(html, dompurifyOpts), 'text/html');
                        // Use getSelectorLevel if available
                        let sel_src = selector_source;
                        if (typeof getSelectorLevel === 'function' && typeof selector_level !== 'undefined' && selector_level) {
                            sel_src = getSelectorLevel(selector_source);
                        }
                        let article_new = doc.querySelector(sel_src);
                        
                        if (article_new) {
                            localStorage.setItem(cacheKey, JSON.stringify({
                                timestamp: Date.now(),
                                html: article_new.outerHTML // save the sanitized extracted element
                            }));
                            console.log('[BPC Mod Cache] Saved fetched article to 24-hour cache!');
                        }
                    }
                    
                    // Proceed with original render
                    originalReplaceDomElementExtSrc(url, url_src, html, proxy, base64, selector, text_fail, selector_source, selector_archive, blocked);
                };
            }
        }
    }
}
