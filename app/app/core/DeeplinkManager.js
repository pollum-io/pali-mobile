'use strict';

import qs from 'qs';
import WalletConnect from '../core/WalletConnect';
import { util, URL } from 'gopocket-core';

class DeeplinkManager {
	constructor(_navigation) {
		this.navigation = _navigation;
		this.pendingDeeplink = null;
	}

	setDeeplink = url => (this.pendingDeeplink = url);

	getPendingDeeplink = () => this.pendingDeeplink;

	expireDeeplink = () => (this.pendingDeeplink = null);

	handleBrowserUrl(url, callback) {
		this.navigation.navigate('BrowserTabHome');
		if (callback) {
			callback(url);
		} else {
			this.navigation.navigate('BrowserView', {
				newTabUrl: url
			});
		}
	}

	parse(url, { browserCallBack, origin, onHandled }) {
		//https://gopocket.security/wc?uri=wc%3A5f56ad2a-d7c4-4777-a496-2eae559b3315%401%3Fbridge%3Dhttps%253A%252F%252Fe.bridge.walletconnect.org%26key%3Dd1684b33be43d39f37552b5720fc68ef5e0edd457f3212d61a27abe34267e452
		const urlObj = new URL(url);
		let params;

		if (urlObj.query.length) {
			try {
				params = qs.parse(urlObj.query.substring(1));
			} catch (e) {
				util.logDebug('leon.w@deeplink.invalid ', e);
			}
		}

		const handled = () => onHandled?.();
		switch (urlObj.protocol.replace(':', '')) {
			case 'https':
				// eslint-disable-next-line no-case-declarations
				let newUrl = unescape(url);
				//TODO: update api url to Pali ones
				if (newUrl.startsWith('https://gopocket.security/wc?uri=')) {
					newUrl = newUrl.replace('https://gopocket.security/wc?uri=', '');
					handled();
					if (!WalletConnect.isValidUri(newUrl)) return;
					// eslint-disable-next-line no-case-declarations
					const redirect = params && params.redirect;
					// eslint-disable-next-line no-case-declarations
					const autosign = params && params.autosign;
					// eslint-disable-next-line no-case-declarations
					WalletConnect.newSession(newUrl, redirect, autosign);
				}
				break;
			case 'wc':
				handled();
				if (!WalletConnect.isValidUri(url)) return;
				// eslint-disable-next-line no-case-declarations
				let redirect = params && params.redirect;
				// eslint-disable-next-line no-case-declarations
				let autosign = params && params.autosign;
				// eslint-disable-next-line no-case-declarations
				WalletConnect.newSession(url, redirect, autosign);
				break;
			case 'gopocket':
				newUrl = unescape(url);
				//TODO: update api url to Pali ones
				newUrl = newUrl.replace('gopocket://wc?uri=', '');
				handled();
				if (!WalletConnect.isValidUri(newUrl)) return;
				// eslint-disable-next-line no-case-declarations
				redirect = params && params.redirect;
				// eslint-disable-next-line no-case-declarations
				autosign = params && params.autosign;
				// eslint-disable-next-line no-case-declarations
				WalletConnect.newSession(newUrl, redirect, autosign);
				break;

			// Specific to the browser screen
			// For ex. navigate to a specific dapp
			// case 'dapp':
			// Enforce https
			// handled();
			// urlObj.set('protocol', 'https:');
			// this.handleBrowserUrl(urlObj.href, browserCallBack);
			// break;
			default:
				return false;
		}

		return true;
	}
}

let instance = null;

const SharedDeeplinkManager = {
	init: navigation => {
		instance = new DeeplinkManager(navigation);
	},
	parse: (url, args) => instance.parse(url, args),
	setDeeplink: url => instance.setDeeplink(url),
	getPendingDeeplink: () => instance.getPendingDeeplink(),
	expireDeeplink: () => instance.expireDeeplink(),
	handleBrowserUrl: (url, callback) => instance.handleBrowserUrl(url, callback)
};

export default SharedDeeplinkManager;
